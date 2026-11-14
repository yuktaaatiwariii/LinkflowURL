"use strict";
/**
 * Shared persistence record shapes.
 *
 * These interfaces mirror the PostgreSQL rows and the in-memory fallback
 * records. They live in their own module so the developer API (and any other
 * module) can depend on them without importing the HTTP server entry point.
 */
Object.defineProperty(exports, "__esModule", { value: true });
