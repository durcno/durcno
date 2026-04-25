import { type DDLStatement, ddl, type MigrationOptions } from "durcno/migration";


// Positive: Full options
const _fullOptions: MigrationOptions = {
  transaction: true,
};

// Positive: Empty options (all optional)
const _emptyOptions: MigrationOptions = {};

// Positive: execution option with 'joined'
const _joinedOptions: MigrationOptions = {
  execution: "joined",
};

// Positive: execution option with 'sequential'
const _sequentialOptions: MigrationOptions = {
  execution: "sequential",
};

// Positive: both options together
const _bothOptions: MigrationOptions = {
  transaction: false,
  execution: "sequential",
};

// Negative: invalid execution value
const _invalidExecution: MigrationOptions = {
  // @ts-expect-error: execution must be 'joined' or 'sequential'
  execution: "parallel",
};

