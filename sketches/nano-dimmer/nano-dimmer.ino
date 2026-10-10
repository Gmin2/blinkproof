const int KNOB = A7;
const int LED = 9;

void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);
  Serial.println("dimmer ready");
}

void loop() {
  int level = analogRead(KNOB) / 4;
  analogWrite(LED, level);
  delay(20);
}
