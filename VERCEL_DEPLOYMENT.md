# Vercel Deployment Guide

This guide explains how to deploy this Evidence app to Vercel.

## Prerequisites

- Vercel account (already set up ✓)
- Git repository connected to Vercel
- MotherDuck token (if using MotherDuck data source)

## Deployment Steps

### 1. Import Project to Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your Git repository containing this Evidence project
4. Vercel will automatically detect the `vercel.json` configuration

### 2. Configure Build Settings

The `vercel.json` file already contains the correct settings:
- **Build Command**: `npm run sources && npm run build`
- **Output Directory**: `build`
- **Install Command**: `npm install`

Vercel should automatically pick these up from the config file.

### 3. Set Environment Variables

#### Method 1: Using Evidence Dev Server (Recommended)

1. Run the Evidence dev server locally:
   ```bash
   npm run dev
   ```

2. Navigate to [http://localhost:3000/settings#deploy](http://localhost:3000/settings#deploy)

3. Click the **Copy All** button to copy all environment variables

4. In Vercel:
   - Go to your project → Settings → Environment Variables
   - Paste the copied variables

#### Method 2: Manual Configuration

If you have a MotherDuck connection, you'll need to set:

```
EVIDENCE_SOURCE__motherduck__token=<your-motherduck-token>
```

Replace `<your-motherduck-token>` with your actual MotherDuck authentication token.

**Note**: The ODS source is a JavaScript source and doesn't require additional credentials.

### 4. Deploy

Click the **Deploy** button in Vercel. Your app will be deployed to:
```
https://[your-project-name].vercel.app
```

## Post-Deployment

### Custom Domain (Optional)
- Configure custom domains in: Settings → Domains

### Scheduled Data Updates (Optional)
Set up GitHub Actions with Vercel deploy hooks to refresh data on a schedule.

### Password Protection (Optional)
Enable password protection via Vercel's paid plan ($150/month minimum):
- Settings → Deployment Protection → Password protection

## Troubleshooting

### Build Fails
- Check that all environment variables are correctly set
- Verify Node version compatibility (requires Node >= 18.0.0)
- Check build logs in Vercel dashboard for specific errors

### Data Not Loading
- Verify environment variables are set correctly
- Check that source credentials are valid
- Review function logs in Vercel dashboard

## Files Created for Deployment

- `vercel.json` - Vercel configuration file with build settings
