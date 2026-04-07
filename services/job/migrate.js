import { sql } from "./dist/utils/db.js";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
    try {
        await sql`ALTER TABLE jobs RENAME COLUMN posted_by_recruiter TO posted_by_recruiter_id;`;
        console.log("Migration completed: renamed column");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrate();