import type { Options } from "@docusaurus/plugin-content-docs";
import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";
import versionsInfo from "./versionsInfo.json";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Durcno",
  tagline:
    "A PostgreSQL Query Builder and Migration Manager for TypeScript, from the future.",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
    faster: true,
  },

  // Set the production url of your site here
  url: "https://durcno.dev",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "durcno", // Usually your GitHub org/user name.
  projectName: "durcno", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  markdown: {
    format: "detect",
  },

  presets: [
    [
      "classic",
      {
        docs: false,
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          editUrl: "https://github.com/durcno/durcno/edit/main/website/blog/",
          // Useful options to enforce blogging best practices
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      {
        path: "docs",
        breadcrumbs: true,
        editUrl: "https://github.com/durcno/durcno/edit/main/website/",
        routeBasePath: "docs",
        include: ["**/*.md"],
        exclude: [
          "**/_*.{js,jsx,ts,tsx}",
          "**/_*/**",
          "**/*.test.{js,jsx,ts,tsx}",
          "**/__tests__/**",
        ],
        sidebarPath: "./sidebars.ts",
        versions: versionsInfo,
        lastVersion: "latest",
        remarkPlugins: [
          [
            require("@docusaurus/remark-plugin-npm2yarn"),
            {
              sync: true,
              converters: ["pnpm", "bun", "yarn"],
            },
          ],
        ],
      } satisfies Options,
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "releases",
        path: "releases",
        routeBasePath: "releases",
        include: ["**/*.md"],
        sidebarPath: "./sidebarsReleases.ts",
        breadcrumbs: true,
        editUrl: "https://github.com/durcno/durcno/edit/main/website/releases/",
        async sidebarItemsGenerator({ defaultSidebarItemsGenerator, ...args }) {
          const items = await defaultSidebarItemsGenerator(args);
          return items.reverse();
        },
      } satisfies Options,
    ],
    // [
    //   "docusaurus-plugin-typedoc",
    //   {
    //     entryPoints: ["../src/migration/index.ts"],
    //     tsconfig: "../tsconfig.json",
    //     out: "docs/api/migration",
    //     readme: "none",
    //     sidebar: {
    //       autoConfiguration: true,
    //       pretty: true,
    //     },
    //   },
    // ],
  ],

  themeConfig: {
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Durcno",
      logo: {
        alt: "Durcno Logo",
        src: "img/logo.svg",
      },
      items: [
        { to: "/docs/latest/intro", label: "Docs", position: "left" },
        {
          type: "docSidebar",
          sidebarId: "releasesSidebar",
          docsPluginId: "releases",
          label: "Releases",
          position: "left",
        },
        { to: "/blog", label: "Blog", position: "left" },
        { to: "/sponsor", label: "Sponsor", position: "left" },
        {
          type: "docsVersionDropdown",
          position: "right",
          dropdownActiveClassDisabled: true,
        },
        {
          href: "https://github.com/durcno/durcno",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "/docs/latest/getting-started",
            },
            {
              label: "Schema",
              to: "/docs/latest/Schema/overview",
            },
            {
              label: "CRUD",
              to: "/docs/latest/CRUD/overview",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Discord",
              href: "https://discord.gg/JuVrdjeNeQ",
            },
            {
              label: "GitHub",
              href: "https://github.com/durcno/durcno",
            },
            {
              label: "X",
              href: "https://x.com/durcno",
            },
          ],
        },
      ],
      copyright: `<a href="https://github.com/durcno/durcno/blob/main/LICENSE">Apache 2.0</a> - Copyright © ${new Date().getFullYear()} Durcno - Built with Docusaurus`,
    },
    prism: {
      theme: prismThemes.vsLight,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ["bash"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
