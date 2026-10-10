void setup() {
  Serial.begin(115200);
}

void loop() {
  Serial.print("Potentiometer value: ");
  Serial.println(analogRead(A0));
  delay(100);
}
