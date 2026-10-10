#include <Adafruit_NeoPixel.h>
#include <Servo.h>

const int TRIG = 9;
const int ECHO = 10;
const int BUTTON = 2;
const int BUZZER = 8;

Adafruit_NeoPixel ring(16, 6, NEO_GRB + NEO_KHZ800);
Servo gate;

void setup() {
  Serial.begin(9600);
  ring.begin();
  gate.attach(3);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  Serial.println("parts tour");
}

long readCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  return pulseIn(ECHO, HIGH, 30000) / 58;
}

void loop() {
  long cm = readCm();
  int lit = cm <= 0 ? 0 : constrain(map(cm, 100, 5, 0, 16), 0, 16);
  for (int i = 0; i < 16; i++) {
    uint32_t c = 0;
    if (i < lit) c = i < 8 ? ring.Color(0, 60, 0) : i < 12 ? ring.Color(70, 45, 0) : ring.Color(90, 0, 0);
    ring.setPixelColor(i, c);
  }
  ring.show();
  gate.write(digitalRead(BUTTON) == LOW ? 90 : 0);
  if (cm > 0 && cm < 15) tone(BUZZER, 1000, 60);
  Serial.print("cm ");
  Serial.println(cm);
  delay(100);
}
