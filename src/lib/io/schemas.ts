/** Zod schemas for import validation (FR-IO-02). Mirror src/domain/types.ts. */
import { z } from 'zod';

// Implemented by T4.5: PointSchema, PlaySchema, AthleteSchema, LineupSchema, MatchupSchema, InstallSchema,
// SettingsSchema, ExportFileSchema. Records with schemaVersion < SCHEMA_VERSION are accepted loosely
// (passthrough) and migrated with migrateRecord before strict validation.
export const ExportFileSchema = z.never();
