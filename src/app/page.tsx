import ExtractionWorkspace from "../components/extraction-workspace";
import { headers } from "next/headers";
import { localExtractionBypass } from "../server/local-development";

export default async function Home() {
  const host = (await headers()).get("host");
  return <ExtractionWorkspace localBypass={localExtractionBypass(host)} />;
}
