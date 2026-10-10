#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>

const int SOIL = 26;
const int PIXEL = 15;

Adafruit_SSD1306 display(128, 64, &Wire, -1);
Adafruit_NeoPixel light(1, PIXEL, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  // usb serial drops what is printed before the computer opens the port
  while (!Serial) delay(10);
  light.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("oled failed");
    for (;;);
  }
  display.setTextColor(SSD1306_WHITE);
  Serial.println("plant monitor ready");
}

void loop() {
  int moisture = map(analogRead(SOIL), 0, 1023, 0, 100);
  bool dry = moisture < 30;
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println(dry ? "WATER ME" : "HAPPY");
  display.setTextSize(1);
  display.setCursor(0, 30);
  display.print("soil ");
  display.print(moisture);
  display.print("%");
  display.display();
  light.setPixelColor(0, dry ? light.Color(120, 0, 0) : light.Color(0, 120, 0));
  light.show();
  delay(100);
}
