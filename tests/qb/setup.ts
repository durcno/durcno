import { v4 as uuid } from "uuid";
import { runDurcnoCommand } from "../helpers";

import type { Users } from "./schema";

// Re-export Docker utilities from the shared module
export {
  cleanDatabase,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "../docker-utils";

import type { TestContainerInfo } from "../docker-utils";

/**
 * Generate a unique migrations directory name with pattern: migrations.[testName].test
 */
export function generateMigrationsDirPath(testName: string): string {
  return `migrations.test/${testName}`;
}

export function runDurcnoCli(
  command: string,
  configPath: string,
  containerInfo: TestContainerInfo,
  migrationsDirName: string,
) {
  runDurcnoCommand([command, "--config", configPath], {
    ...process.env,
    DB_PORT: containerInfo.port.toString(),
    DB_NAME: containerInfo.dbName,
    MIGRATIONS_DIR: `./${migrationsDirName}`,
  } as Record<string, string>);
}

/**
 * Simple helper to create test users
 */
export function createTestUser(
  overrides: Partial<(typeof Users)["$"]["inferSelect"]> = {},
) {
  return {
    username:
      overrides.username !== undefined
        ? overrides.username
        : `user_${uuid().slice(0, 8)}`,
    email:
      overrides.email !== undefined
        ? overrides.email
        : `${uuid().slice(0, 8)}@test.com`,
    type: overrides.type !== undefined ? overrides.type : ("user" as const),
    status:
      overrides.status !== undefined ? overrides.status : ("active" as const),
    role: overrides.role !== undefined ? overrides.role : ("user" as const),
    ...(overrides.age !== undefined && { age: overrides.age }),
    ...(overrides.bio !== undefined && { bio: overrides.bio }),
    ...(overrides.description !== undefined && {
      description: overrides.description,
    }),
    ...(overrides.points !== undefined && { points: overrides.points }),
    ...(overrides.score !== undefined && { score: overrides.score }),
    ...(overrides.balance !== undefined && { balance: overrides.balance }),
    ...(overrides.isActive !== undefined && { isActive: overrides.isActive }),
    ...(overrides.isVerified !== undefined && {
      isVerified: overrides.isVerified,
    }),
    ...(overrides.birthDate !== undefined && {
      birthDate: overrides.birthDate,
    }),
    ...(overrides.updatedAt !== undefined && {
      updatedAt: overrides.updatedAt,
    }),
    ...(overrides.lastLogin !== undefined && {
      lastLogin: overrides.lastLogin,
    }),
  };
}

/**
 * Simple helper to create test posts
 */
export function createTestPost(
  userId: number,
  overrides: {
    title?: string;
    content?: string;
    slug?: string;
    isPublished?: boolean;
    publishedAt?: Date;
    viewCount?: number;
    likeCount?: number; // bigint columns use number in Durcno
  } = {},
) {
  return {
    userId,
    ...(overrides.title !== undefined && { title: overrides.title }),
    ...(overrides.content !== undefined && { content: overrides.content }),
    ...(overrides.slug !== undefined && { slug: overrides.slug }),
    ...(overrides.isPublished !== undefined && {
      isPublished: overrides.isPublished,
    }),
    ...(overrides.publishedAt !== undefined && {
      publishedAt: overrides.publishedAt,
    }),
    ...(overrides.viewCount !== undefined && {
      viewCount: overrides.viewCount,
    }),
    ...(overrides.likeCount !== undefined && {
      likeCount: overrides.likeCount,
    }),
  };
}

/**
 * Simple helper to create test comments
 */
export function createTestComment(
  postId: number,
  userId: number,
  overrides: {
    body?: string;
  } = {},
) {
  return {
    postId,
    userId,
    body: overrides.body ?? `Test comment ${uuid()}`,
  };
}
