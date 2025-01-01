# Athleto 🏋️‍♂️

![Athleto Landing Page](https://cloud-8c6dpwvfi-hack-club-bot.vercel.app/0image.png)

## Overview
Athleto is a comprehensive fitness tracking and workout management application designed to empower users in their fitness journey.

## Features

### 1. Profile Management
- Complete user profile creation
- Height, weight, age tracking
- BMI calculation
- Fitness and activity level selection

### 2. Workout Planning
- Custom workout plan generation
- Personalized exercise recommendations
- Workout tracking and logging
- Rest day management

### 3. Progress Tracking
- Weight progression charts
- BMI tracking visualization
- Detailed metrics dashboard

## Tech Stack
- Frontend: React, Next.js
- Authentication: Supabase
- Styling: Tailwind CSS

## Prerequisites
- Node.js (v18+)
- npm or yarn
- Supabase account

## Installation

1. Clone the repository
```bash
git clone https://github.com/hridaya423/athleto.git
cd athleto
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables
- Create `.env.local` with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `ANTHROPIC_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

4. Run the development server
```bash
npm run dev
# or
yarn dev
```

## License
MIT License
