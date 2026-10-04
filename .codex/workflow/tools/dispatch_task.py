#!/usr/bin/env python3
"""Run one approved Codex task in an existing worktree (Python 3.11+).

This verifies Git/process binding, not the truth of user approval or review.
The coordinator supplies checked evidence. No worktree creation/integration here.
"""
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import tomllib
import uuid


def run(argv, cwd):
    result = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode:
        raise ValueError(f'Preflight failed: {argv[0]} {argv[1]} (exit {result.returncode})')
    return result.stdout.strip()


def git(root, *args):
    return run(['git', '-C', str(root), *args], root)


def scoped_path(root, relative):
    path = Path(relative)
    if path.is_absolute() or '..' in path.parts:
        raise ValueError('A repository-relative path is required')
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError('Path escapes its repository')
    return resolved


def scope_prefix(scope):
    if not scope or ':' in scope or '\\' in scope or scope.startswith('/') or '..' in scope.split('/'):
        raise ValueError('Invalid reserved path')
    if any(part.startswith('.env') or part == '.git' for part in scope.split('/')):
        raise ValueError('Secret files and Git metadata cannot be implementation surfaces')
    prefix = re.split(r'[*?\[]', scope, 1)[0].rstrip('/')
    if not prefix:
        raise ValueError('Repository-wide wildcard reservations are not allowed')
    return prefix


def overlapping(a, b):
    # Conservative: rejects some disjoint glob pairs rather than permitting overlap.
    x, y = scope_prefix(a), scope_prefix(b)
    return x.startswith(y) or y.startswith(x)


def candidate_fingerprint(root, surfaces):
    changed = set(git(root, 'diff', '--name-only', 'HEAD').splitlines())
    changed.update(git(root, 'ls-files', '--others', '--exclude-standard').splitlines())
    digest = hashlib.sha256()
    for name in sorted(changed):
        if not any(fnmatch.fnmatchcase(name, scope) or name.startswith(scope.rstrip('/') + '/') for scope in surfaces):
            raise ValueError('Candidate contains changes outside reserved surfaces')
        if '.env' in Path(name).parts or Path(name).name.startswith('.env.'):
            raise ValueError('Secret file cannot be a candidate input')
        lexical_path = root / name
        if any(part.is_symlink() for part in [lexical_path, *lexical_path.parents] if part.is_relative_to(root)):
            raise ValueError('Candidate symlink needs explicit manual review')
        path = scoped_path(root, name)
        digest.update(name.encode('utf-8') + b'\0')
        digest.update(b'DELETED' if not path.exists() else path.read_bytes())
        digest.update(b'\0')
    # Include index/worktree boundaries and executable mode without exposing the diff.
    digest.update(git(root, 'diff', '--raw', 'HEAD').encode('utf-8'))
    digest.update(git(root, 'diff', '--cached', '--raw').encode('utf-8'))
    return digest.hexdigest()


def prepare(packet, codex, fingerprint_only=False):
    root = Path(packet['worktree_root']).resolve(strict=True)
    integration = Path(packet['integration_root']).resolve(strict=True)
    if root == integration:
        raise ValueError('A separate task worktree is required')
    for checkout in (root, integration):
        if Path(git(checkout, 'rev-parse', '--show-toplevel')).resolve() != checkout:
            raise ValueError('Checkout root mismatch')
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir')).resolve()
    if Path(git(integration, 'rev-parse', '--path-format=absolute', '--git-common-dir')).resolve() != common:
        raise ValueError('Worktree is not part of the integration repository')
    branch = git(root, 'branch', '--show-current')
    if not branch or branch != packet['expected_branch']:
        raise ValueError('Task branch mismatch (detached HEAD is not enabled by this adapter)')
    base = git(root, 'rev-parse', 'HEAD')
    if base != packet['expected_head']:
        raise ValueError('Expected task HEAD changed')
    mode = packet['mode']
    if mode not in {'implementation', 'verification-only', 'delivery'}:
        raise ValueError('Unknown Implementer mode')
    task = packet['task_id']
    small = packet.get('scope_kind', 'planned') == 'small'
    if packet.get('scope_kind', 'planned') not in {'planned', 'small'}:
        raise ValueError('Unknown scope classification')
    if not re.fullmatch(r'INLINE-\d+' if small else r'TASK-\d+', task):
        raise ValueError('Expected TASK-n (planned) or INLINE-n (small) identifier')
    approval = packet['approval']
    if approval.get('approved') is not True or not approval.get('decision_reference'):
        raise ValueError('Checked approval evidence is required')
    if small:
        if not packet.get('small_scope') or packet['dependencies']:
            raise ValueError('Small route requires explicit inline scope and no planned dependencies')
        body = 'Authorized small scope (no durable feature artifact):\n' + packet['small_scope']
    else:
        spec = scoped_path(integration, packet['spec_path'])
        body = spec.read_text(encoding='utf-8')
        if hashlib.sha256(spec.read_bytes()).hexdigest() != packet['spec_sha256']:
            raise ValueError('Canonical spec revision changed')
        if approval['plan_revision'] not in body or task not in body:
            raise ValueError('Plan/task identifier absent from the canonical spec content')
    head = git(integration, 'rev-parse', 'HEAD')
    if head != packet['integration_head']:
        raise ValueError('Integration HEAD changed; reconcile before dispatch')
    for dependency in packet['dependencies']:
        if dependency.get('accepted') is not True or not dependency.get('review_reference'):
            raise ValueError('Dependency has no accepted review evidence')
        git(integration, 'merge-base', '--is-ancestor', dependency['integrated_sha'], head)
    surfaces = packet['edit_surfaces']
    if not surfaces or not packet.get('criteria') or not packet.get('checks'):
        raise ValueError('Bounded surfaces, criteria and check instructions are required')
    for surface in surfaces:
        scope_prefix(surface)
    fingerprint = candidate_fingerprint(root, surfaces)
    if mode == 'implementation' and git(root, 'status', '--porcelain'):
        raise ValueError('New implementation dispatch requires a clean checkout; preserve and reconcile existing work')
    if mode in {'verification-only', 'delivery'} and not fingerprint_only:
        if not packet.get('candidate_stopped_reference') or packet.get('candidate_fingerprint') != fingerprint:
            raise ValueError('Stopped candidate receipt and exact current fingerprint are required')
    resources = packet['shared_resources']
    if not isinstance(resources, list):
        raise ValueError('Shared resources must be explicitly listed (possibly empty)')
    if not packet.get('logical_independence_reference'):
        raise ValueError('Logical dependency/resource review is required')
    if not packet.get('runtime_audit_reference'):
        raise ValueError('Actual sandbox, MCP, app-tools and hook audit receipt is required')
    role_path = root / '.codex/agents/implementer.toml'
    git(root, 'ls-files', '--error-unmatch', '.codex/agents/implementer.toml', 'AGENTS.md', '.codex/workflow/docs/task-worktrees.md')
    role = tomllib.loads(role_path.read_text(encoding='utf-8'))
    if role.get('name') != 'implementer' or not role.get('developer_instructions'):
        raise ValueError('Native Implementer instructions not loaded')
    executable = shutil.which(codex)
    if not executable:
        raise ValueError('Codex CLI executable not found')
    help_text = run([executable, 'exec', '--help'], root)
    for flag in ('--cd', '--json', '--sandbox', '--config', '--strict-config'):
        if flag not in help_text:
            raise ValueError(f'Installed CLI lacks {flag}; no dispatch performed')
    # Enumerate actual merged project/user MCP configuration without printing credentials.
    servers = json.loads(run([executable, 'mcp', 'list', '--json'], root))
    if not isinstance(servers, list) or any(not isinstance(s.get('name'), str) for s in servers):
        raise ValueError('Cannot verify the actual MCP inventory')
    names = {s['name'] for s in servers}
    access = packet.get('mcp_access', {})
    if access and (mode != 'delivery' or not packet.get('git_authorization')):
        raise ValueError('This dispatcher enables reviewed MCP access only for authorized Delivery')
    argv = [executable, 'exec', '-C', str(root), '--strict-config', '--json', '-s', 'workspace-write',
            '-c', 'developer_instructions=' + json.dumps(role['developer_instructions']),
            '-c', 'agents.enabled=false']
    for name in sorted(names | {'github', 'linear', 'engram', 'pencil', 'codegraph'}):
        key = 'mcp_servers.' + json.dumps(name)
        binding = access.get(name)
        if binding:
            if name not in names or not binding.get('review_reference') or not binding.get('enabled_tools'):
                raise ValueError('MCP access requires an observed catalog and reviewed exact tool allowlist')
            if name in {'linear', 'engram', 'pencil'}:
                raise ValueError('Implementer cannot use memory/tracking/design providers')
            argv += ['-c', key + '.enabled=true', '-c', key + '.enabled_tools=' + json.dumps(binding['enabled_tools'])]
        else:
            argv += ['-c', key + '.enabled=false']
    if set(access) - names:
        raise ValueError('An allowed MCP server is absent from the observed inventory')
    argv += ['-']
    prompt = ('AI-WORKFLOW DELEGATED ROLE: implementer\n'
              'Adopt only the supplied mode; do not spawn/delegate writers. Verify cwd, branch and HEAD before action. '
              'Return a scoped handoff; do not mark the task DONE or edit the canonical spec.\n'
              + json.dumps(packet, ensure_ascii=False) + '\nGoverning read-only input snapshot:\n' + body)
    reservation = {'task_id': task, 'root': str(root), 'branch': branch, 'mode': mode,
                   'edit_surfaces': surfaces, 'shared_resources': resources, 'pid': os.getpid(),
                   'candidate_fingerprint': fingerprint}
    return argv, prompt, root, common, reservation


class Reservation:
    """Cross-process lock under shared Git metadata; stale receipts block until reconciled."""
    def __init__(self, common, record):
        self.state = common / 'ai-workflow-dispatch'
        self.record = record
        self.receipt = self.state / (uuid.uuid4().hex + '.json')
        self.lock = self.state / 'lock'

    def __enter__(self):
        self.state.mkdir(exist_ok=True)
        for _ in range(100):
            try:
                self.lock.mkdir()
                break
            except FileExistsError:
                time.sleep(0.05)
        else:
            raise ValueError('Dispatch registry locked; reconcile before retry')
        try:
            active = [json.loads(p.read_text(encoding='utf-8')) for p in self.state.glob('*.json')]
            if len(active) >= 2:
                raise ValueError('Two dispatches already reserved; wait or reconcile stale receipts')
            for other in active:
                if (other['root'] == self.record['root'] or other['branch'] == self.record['branch']
                        or other['task_id'] == self.record['task_id']):
                    raise ValueError('Task/root/branch already reserved')
                if self.record['mode'] == 'delivery' or other['mode'] == 'delivery':
                    raise ValueError('Delivery must run serially with all writers stopped')
                if set(other['shared_resources']) & set(self.record['shared_resources']):
                    raise ValueError('Shared logical resource overlaps')
                if any(overlapping(a, b) for a in other['edit_surfaces'] for b in self.record['edit_surfaces']):
                    raise ValueError('Reserved file surfaces overlap')
            self.receipt.write_text(json.dumps(self.record), encoding='utf-8')
        finally:
            self.lock.rmdir()
        return self

    def __exit__(self, exc_type, exc, tb):
        # Interrupted/uncertain runs deliberately keep their receipt for liveness recovery.
        if exc_type is None:
            self.receipt.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--packet', required=True, help='Transient approved JSON packet, outside specs')
    parser.add_argument('--codex', default='codex')
    parser.add_argument('--dry-run', action='store_true', help='Preflight only; no model run, no reservation')
    parser.add_argument('--fingerprint', action='store_true', help='Inspect candidate identity only; no model run')
    args = parser.parse_args()
    try:
        packet = json.loads(Path(args.packet).read_text(encoding='utf-8'))
        argv, prompt, root, common, record = prepare(packet, args.codex, args.fingerprint)
        if args.dry_run or args.fingerprint:
            print(json.dumps({'status': 'PREFLIGHT_ONLY', 'root': str(root), 'branch': record['branch'],
                              'task': record['task_id'], 'role': 'implementer', 'mode': record['mode'],
                              'candidate_fingerprint': record['candidate_fingerprint']}))
            return 0
        with Reservation(common, record) as reservation:
            # No background daemon, timeout or shell string. Parent waits for the exact child.
            # CLI JSON events are transient stdout; preserve only concise evidence in the spec.
            process = subprocess.Popen(argv, cwd=root, stdin=subprocess.PIPE, text=True, encoding='utf-8')
            record['child_pid'] = process.pid
            reservation.receipt.write_text(json.dumps(record), encoding='utf-8')
            process.communicate(prompt)
            return process.returncode
    except (ValueError, KeyError, OSError, json.JSONDecodeError, tomllib.TOMLDecodeError) as error:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(error)}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
