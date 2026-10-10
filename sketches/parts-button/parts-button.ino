const int BUTTON = 2;
int presses = 0;
bool last = HIGH;
unsigned long changed = 0;

void setup() {
  Serial.begin(9600);
  pinMode(BUTTON, INPUT_PULLUP);
}

void loop() {
  bool now = digitalRead(BUTTON);
  if (now != last && millis() - changed > 30) {
    changed = millis();
    last = now;
    if (now == LOW) {
      presses++;
      Serial.print("presses ");
      Serial.println(presses);
    }
  }
}
