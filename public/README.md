# Medical OCR Frontend

A simple, clean web interface for the Medical Bill OCR Amount Detection service.

## Features

- **Dual Input Methods**: 
  - Text input: Paste bill text directly
  - Image upload: Upload JPEG, PNG, or PDF files

- **Live Processing Pipeline**: Watch each step of the extraction process:
  1. Raw token extraction from text/image
  2. Amount normalization (fixing OCR errors)
  3. Amount classification (total, paid, due)
  4. Final filtered output

- **Visual Results**: Clean display of extracted amounts with currency formatting

## Usage

1. Start the backend server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Choose your input method:
   - **Text Tab**: Paste bill text containing amounts
   - **Image Tab**: Upload or drag-and-drop a bill image

4. Click "Process Bill" and watch the pipeline in action

## How It Works

The frontend makes sequential API calls to each step of the pipeline:
- `POST /api/extract/step1` - Extract raw tokens
- `POST /api/extract/step2` - Normalize amounts
- `POST /api/extract/step3` - Classify amounts
- `POST /api/extract/step4` - Get final output

Each step's results are displayed in real-time, showing you exactly what's happening at each stage.

## Design

- Clean, modern UI with gradient accents
- No AI-looking gimmicks - just straightforward functionality
- Responsive design works on desktop and mobile
- Real-time status updates with visual indicators
- Error handling with clear messages
