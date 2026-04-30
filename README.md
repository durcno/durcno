<p align="center">
  <img alt="NPM Downloads" src="https://img.shields.io/npm/dw/durcno" alt="Downloads" />
  <img src="https://img.shields.io/badge/Node.js-24%2B-339935?style=flat&logo=node.js&logoColor=white" alt="Node.js 24+" />
  <img src="https://img.shields.io/badge/PostgreSQL-14%2B-336791?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL 14+" />
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat" alt="License" />
  <img src="https://img.shields.io/badge/vitest--green?logo=vitest" alt="License" />
</p>

<h1 align="center">Durcno</h1>

<p align="center">
  <strong>A PostgreSQL Query Builder and Migration Manager for TypeScript, from the future.</strong>
</p>

<p align="center">
  Intuitive • Type-safe • Runtime-safe • Robust
</p>

---

## Features

- **🔗 Relation Mapping** — Intuitive `many`, `one`, and `fk` relations with full type inference.
- **🦾 Robust Migrations** — Auto-generated, reversible, and squashable migrations for production applications.
- **⚡ Zero Runtime Overhead** — Thin abstraction layer that compiles to efficient SQL.
- **🔌 Multiple Drivers** — Support for `pg`, `postgres`, `bun`, and `pglite` drivers.
- **🛡️ Zod Integration** — Built-in Zod validators for schema validation and type inference.
- **🌍 PostGIS Support** — First-class geographic column types for spatial queries.

## Setup

```bash
npm add durcno@alpha
```

```bash
npm exec durcno init
```

## Getting Started

Get started with Durcno by following our comprehensive documentation.

**[Getting Started | Durcno](https://durcno.dev/docs/latest/getting-started)**

> [!WARNING]
> Durcno is currently in the alpha stage.
> Avoid using it in any critical or large project until it reaches beta. Expect bugs and breaking changes. However, your feedback is invaluable to help us shape the future of Durcno!

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting PRs.

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---