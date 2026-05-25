/** Default files written when the user creates a new BigTeX project. */

export const BLANK_MAIN_TEX = `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}

\\title{Untitled}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle

\\end{document}
`;

export const BLANK_REFERENCES_BIB = `@comment{ BibTeX references for this project }
`;

export const BLANK_PROJECT_FILES = [
  { name: "main.tex", content: BLANK_MAIN_TEX },
  { name: "references.bib", content: BLANK_REFERENCES_BIB },
] as const;
