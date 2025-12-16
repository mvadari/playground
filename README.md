# XRPL Transaction Test Generator

A visual, Scratch-like interface for building XRPL (XRP Ledger) transaction tests. This tool allows you to construct XRPL transactions by dragging and dropping blocks representing transaction types and fields.

## Features

- 🎨 **Visual Block-Based Interface** - Scratch-inspired drag-and-drop UI
- 🔄 **Dynamic Field Generation** - Automatically loads transaction types and fields from `definitions.json`
- ✅ **Real-time Validation** - Validates transaction structure as you build
- 📋 **JSON Export** - Copy to clipboard or download as JSON file
- 📚 **Example Templates** - Pre-built examples for common transaction types
- 🎯 **Type-Safe** - Color-coded blocks by field type (Account, Amount, Number, Hash, Blob)

## Usage

### Running Locally

1. Clone this repository
2. Serve the files using any HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser

### Building Transactions

1. **Start with a Transaction Type** - Drag a transaction type block (e.g., Payment, TrustSet) from the palette to the workspace
2. **Add Fields** - Drag field blocks from the categorized sections in the palette
3. **Fill in Values** - Click on fields in the workspace to enter values
4. **View JSON** - See the generated JSON in real-time on the right panel
5. **Export** - Copy to clipboard or download the JSON

### Example Transactions

Use the "Load Example" dropdown to quickly populate the workspace with common transaction types:
- **Payment** - Simple XRP payment
- **TrustSet** - Create a trust line
- **AccountSet** - Modify account settings
- **OfferCreate** - Create a DEX offer

## File Structure

- `index.html` - Main HTML structure
- `styles.css` - Scratch-like styling and animations
- `app.js` - Core application logic
- `definitions.json` - XRPL transaction and field definitions

## Block Categories

Blocks are color-coded by type:
- 🟣 **Purple** - Transaction Types
- 🟠 **Orange** - Account Fields
- 🟡 **Yellow** - Amount Fields
- 🟢 **Green** - Number Fields (UInt32, UInt64, etc.)
- 🔴 **Red** - Hash Fields
- 🟣 **Pink** - Blob Fields
- 🔵 **Blue** - Common Fields

## Technologies

- Pure HTML/CSS/JavaScript (no frameworks)
- HTML5 Drag and Drop API
- CSS Grid & Flexbox
- Modern ES6+ JavaScript

## GitHub Pages Deployment

This project includes a GitHub Actions workflow for automatic deployment to GitHub Pages.

### Setup Instructions

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to **Pages** (under "Code and automation")
   - Under "Build and deployment":
     - Source: Select **GitHub Actions**
   - The workflow will automatically deploy on every push to `main`

3. **Access Your Site**:
   - Your site will be available at: `https://<username>.github.io/<repository-name>/`
   - The deployment URL will also appear in the Actions tab after successful deployment

### Manual Deployment

You can also trigger deployment manually:
- Go to the **Actions** tab in your repository
- Select the "Deploy to GitHub Pages" workflow
- Click "Run workflow"

### Workflow Details

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:
- Triggers on push to `main` branch
- Can be manually triggered via workflow_dispatch
- Uploads all files as a Pages artifact
- Deploys to GitHub Pages with proper permissions

## License

MIT License - Feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

