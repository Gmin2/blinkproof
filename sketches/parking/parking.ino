#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>

const int TRIG = 9;
const int ECHO = 10;
const int RING = 6;
const int BUZZER = 8;

Adafruit_SSD1306 display(128, 64, &Wire, -1);
Adafruit_NeoPixel ring(16, RING, NEO_GRB + NEO_KHZ800);

unsigned long lastBeep = 0;

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  return us == 0 ? -1 : us / 58;
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  ring.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("oled failed"));
    for (;;);
  }
  display.setTextColor(SSD1306_WHITE);
  Serial.println(F("parking sensor ready"));
}

void loop() {
  long cm = readCm();
  const char *word = cm < 0 || cm > 100 ? "OK" : cm > 30 ? "SLOW" : cm > 10 ? "CLOSE" : "STOP";

  int lit = cm < 0 ? 0 : constrain(map(cm, 100, 10, 1, 16), 0, 16);
  for (int i = 0; i < 16; i++) {
    uint32_t c = 0;
    if (i < lit) c = i < 8 ? ring.Color(0, 80, 0) : i < 12 ? ring.Color(90, 60, 0) : ring.Color(120, 0, 0);
    ring.setPixelColor(i, c);
  }
  ring.show();

  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println(word);
  display.setTextSize(1);
  display.setCursor(0, 32);
  if (cm < 0) display.print(F("no car"));
  else {
    display.print(cm);
    display.print(F(" cm"));
  }
  display.display();

  // beeps get faster as the car gets closer, one long tone at stop
  if (cm >= 0 && cm <= 10) tone(BUZZER, 1500);
  else if (cm > 0 && cm <= 100 && millis() - lastBeep > (unsigned long)cm * 10) {
    lastBeep = millis();
    tone(BUZZER, 1000, 40);
  } else if (cm < 0 || cm > 100) noTone(BUZZER);

  Serial.print(F("cm "));
  Serial.println(cm);
  delay(60);
}
