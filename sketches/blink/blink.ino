void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("blink ready");
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
