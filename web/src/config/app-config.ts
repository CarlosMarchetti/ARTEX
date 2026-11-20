import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "ARTEX",
  version: packageJson.version,
  copyright: `© ${currentYear}, ARTEX.`,
  meta: {
    title: "ARTEX PT-BR — Pentest e Bug Bounty",
    description: "Testes assistidos por IA, escopo documentado e evidências organizadas, em português.",
  },
};
