// Quick test to verify Google Cloud Vision API setup
const vision = require("@google-cloud/vision");

async function testVisionAPI() {
  try {
    console.log("Testing Google Cloud Vision API...\n");

    // Check if credentials file exists
    const fs = require("fs");
    const credPath = "./tidy-ivy-479918-k2-24f253365269.json";

    if (!fs.existsSync(credPath)) {
      console.error("❌ Credentials file not found:", credPath);
      return;
    }
    console.log("✅ Credentials file found");

    // Initialize client
    const client = new vision.ImageAnnotatorClient({
      keyFilename: credPath,
    });
    console.log("✅ Vision client initialized");

    // Test with a simple image URL (Google's test image)
    const [result] = await client.textDetection(
      "https://cloud.google.com/vision/docs/images/sign_text.png"
    );

    if (result.textAnnotations && result.textAnnotations.length > 0) {
      console.log("✅ API is working!");
      console.log("\nDetected text:", result.textAnnotations[0].description);
    } else {
      console.log("⚠️  API responded but no text detected");
    }

    console.log("\n✅ Google Cloud Vision API is properly configured!");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("Error code:", error.code);
    console.error("\nPossible issues:");
    console.error("1. Google Cloud Vision API not enabled in your project");
    console.error("2. Service account lacks proper permissions");
    console.error("3. Invalid credentials file");
    console.error("\nTo fix:");
    console.error(
      "1. Go to: https://console.cloud.google.com/apis/library/vision.googleapis.com"
    );
    console.error("2. Select project: tidy-ivy-479918-k2");
    console.error('3. Click "ENABLE" if not already enabled');
  }
}

testVisionAPI();
