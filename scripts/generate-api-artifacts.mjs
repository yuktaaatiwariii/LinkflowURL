#!/usr/bin/env node
/**
 * Regenerates the public API artifacts from `src/constants/apiReference.json`.
 *
 *   npm run docs:generate
 *
 * Outputs:
 *   public/openapi.json
 *   public/linkflow-postman-collection.json
 *   public/linkflow-postman-environment.json
 */
import { writeArtifacts } from './lib/api-artifacts.mjs';

const written = writeArtifacts();
console.log(`Generated ${written.length} API artifacts:`);
for (const file of written) console.log(`  public/${file}`);
