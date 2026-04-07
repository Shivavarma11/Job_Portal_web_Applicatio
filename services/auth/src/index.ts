import app from "./app.js";
import dotenv from "dotenv"
import { sql } from "./utils/db.js";
import {createClient} from "redis"

dotenv.config();

export const redisClient = createClient({
    url : process.env.REDIS_URL
})

redisClient.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
});

redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

redisClient.connect()
.catch((err) => {
    console.error('❌ Failed to connect to Redis:', err.message);
    process.exit(1);
})


async function initDb() {
    try {
        await sql`
        DO $$
        BEGIN
            CREATE TYPE user_role AS ENUM ('jobseeker','recruiter');
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'Type user_role already exists, skipping';
        END $$;
        `;

        await sql`
            CREATE TABLE  IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            phone_number VARCHAR(15) NOT NULL,
            role user_role NOT NULL,
            bio TEXT,
            resume VARCHAR(255),
            resume_public_id VARCHAR(255),
            profile_pic VARCHAR(255),
            profile_pic_public_id VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            subscription TIMESTAMPTZ
            )
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS skills (
        skill_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE
        
        )
        `;

        await sql`
        CREATE TABLE IF NOT EXISTS user_skills(
            user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            skill_id INTEGER NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
            PRIMARY KEY (user_id,skill_id
            )
        )
        `;
        console.log("Database tables checked/created successfully");
        
    } catch (error) {
        console.log("Error initializing database",error);
        process.exit(1);
        
    }
    
}

initDb().then(()=>{
    app.listen(process.env.PORT,()=>{console.log(`Auth service is running on ${process.env.PORT}`)})

})

