#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

void setup() {
  Serial.begin(9600);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("oled failed");
    for (;;);
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("blinkproof");
  display.setTextSize(1);
  display.setCursor(0, 24);
  display.println("hello from the sim");
  display.display();
  Serial.println("oled ok");
}

void loop() {
  int v = analogRead(A0);
  display.fillRect(0, 40, 128, 16, SSD1306_BLACK);
  display.setCursor(0, 40);
  display.print("A0 = ");
  display.print(v);
  display.display();
  delay(100);
}
