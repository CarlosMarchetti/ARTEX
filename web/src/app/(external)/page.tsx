import { redirect } from "next/navigation";

export default function Home() {
  redirect("/getting-started");
  return <>Coming Soon</>;
}
