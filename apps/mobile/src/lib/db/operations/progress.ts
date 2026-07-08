/**
 * Progress/stats operations for mobile — thin wiring over the shared
 * @bahar/db-operations factory (logic + tests live there).
 */

import { makeProgressTable } from "@bahar/db-operations";
import { getDb } from "./get-db";

export const progressTable = makeProgressTable({ getDb });
