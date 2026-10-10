#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel ring(16, 6, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(9600);
  ring.begin();
  ring.setPixelColor(0, ring.Color(255, 0, 0));
  ring.setPixelColor(1, ring.Color(0, 255, 0));
  ring.setPixelColor(15, ring.Color(0, 0, 255));
  ring.setPixelColor(7, ring.Color(18, 52, 86));
  ring.show();
  Serial.println("shown");
}

void loop() {}
