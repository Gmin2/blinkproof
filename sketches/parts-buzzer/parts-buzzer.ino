void setup() {
  Serial.begin(9600);
  tone(8, 440, 300);
  delay(500);
  tone(8, 1000);
  delay(200);
  noTone(8);
  Serial.println("played");
}

void loop() {}
