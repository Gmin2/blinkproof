#include <Servo.h>

Servo arm;

void setup() {
  Serial.begin(9600);
  arm.attach(9);
  arm.write(0);
  delay(500);
  arm.write(90);
  delay(500);
  arm.write(180);
  Serial.println("swept");
}

void loop() {}
