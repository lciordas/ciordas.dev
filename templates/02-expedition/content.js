// Everything you edit lives in this file. No other file needs to change to fill the site in.
window.SITE = {
  title: "Lucas Ciordas — Portfolio",
  description: "Portfolio of Lucas Ciordas.",

  // Top-left block
  logo: "CIORDAS",
  copyright: "// Copyright © 2026",
  owner: "Lucas Ciordas",
  rights: "All Rights Reserved.",

  // Top-right block
  manifestoLabel: "////// Manifesto",
  manifesto: "Placeholder manifesto. Say what you build and why it matters in about twenty words here.",

  // Bottom-left block
  scrollHint: "Scroll down to\ndiscover.",
  soundLabel: "Sound:",
  soundOn: "On",
  soundOff: "Off",
  closeLabel: "Close",
  loaderText: "LOADING SCENE",

  // Soft, blurred words that float in the fog behind each section
  ambientText: ["SECTION 01 / OPEN", "BUILD 2026", "LOAD OFF/2", "PRE LOAD", "2026", "FIELD NOTES", "POS 01 / 03"],

  // The last project uses the ring section. All earlier projects get a crystal each,
  // so adding a project to this list adds a crystal and lengthens the scroll loop.
  projects: [
    {
      code: "PORTFOLIO_01_01",
      name: "PROJECT ONE",
      mark: "P1",
      metaLabel: "YEAR",
      metaValues: ["20.26", "+01.00"],
      date: "01.02.2026",
      cta: "CLICK TO EXPLORE",
      summaryLabel: "////// Summary",
      summary: [
        "Placeholder summary for Project One. Describe the problem, who it was for, and what you personally did. Two or three plain sentences work best here.",
        "Placeholder second paragraph. Describe the result, what you learned, and anything a visitor should remember about this piece of work."
      ],
      discoverLabel: "/// Discover",
      discover: [
        { label: "[CODE]", url: "#" },
        { label: "[DEMO]", url: "#" },
        { label: "[NOTES]", url: "#" }
      ],
      visitLabel: "/// Visit",
      visit: { label: "[website]", url: "#" }
    },
    {
      code: "PORTFOLIO_02_01",
      name: "PROJECT TWO",
      mark: "P2",
      metaLabel: "YEAR",
      metaValues: ["20.25", "+02.00"],
      date: "03.09.2025",
      cta: "CLICK TO EXPLORE",
      summaryLabel: "////// Summary",
      summary: [
        "Placeholder summary for Project Two. Describe the problem, who it was for, and what you personally did. Two or three plain sentences work best here.",
        "Placeholder second paragraph. Describe the result, what you learned, and anything a visitor should remember about this piece of work."
      ],
      discoverLabel: "/// Discover",
      discover: [
        { label: "[CODE]", url: "#" },
        { label: "[DEMO]", url: "#" }
      ],
      visitLabel: "/// Visit",
      visit: { label: "[website]", url: "#" }
    },
    {
      code: "PORTFOLIO_03_01",
      name: "PROJECT THREE",
      mark: "P3",
      metaLabel: "YEAR",
      metaValues: ["20.24", "+03.00"],
      date: "11.05.2024",
      cta: "CLICK TO EXPLORE",
      summaryLabel: "////// Summary",
      summary: [
        "Placeholder summary for Project Three. Describe the problem, who it was for, and what you personally did. Two or three plain sentences work best here.",
        "Placeholder second paragraph. Describe the result, what you learned, and anything a visitor should remember about this piece of work."
      ],
      discoverLabel: "/// Discover",
      discover: [
        { label: "[CODE]", url: "#" },
        { label: "[DEMO]", url: "#" }
      ],
      visitLabel: "/// Visit",
      visit: { label: "[website]", url: "#" }
    }
  ],

  // Final section. The particle form morphs into each link's "mark" when selected.
  // The first entry uses the default stone form; set mark to null to keep it.
  links: [
    { label: "About", mark: null, url: "#" },
    { label: "GitHub", mark: "GH", url: "https://github.com/lciordas" },
    { label: "LinkedIn", mark: "in", url: "#" },
    { label: "Email", mark: "@", url: "mailto:you@example.com" },
    { label: "Resume", mark: "CV", url: "#" }
  ],

  // Palette. Hex values, sRGB.
  colors: {
    fog: "#a0a5b1",
    fogLight: "#c5c9d3",
    fogDark: "#6d7384",
    stone: "#6c7282",
    glow: "#eaf3ff",
    rim: "#bcd6ff",
    panel: "#121824"
  }
};
