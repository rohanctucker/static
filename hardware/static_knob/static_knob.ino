// Static: a physical tuning knob for the sky radio.
//
// Parts: any Arduino with USB serial (Uno, Nano, Leonardo, Pro Micro ...), a 10k potentiometer,
//        and optionally a push button.
// Wiring:
//   potentiometer  outer legs -> 5V and GND (3.3V on 3.3-volt boards), middle leg (wiper) -> A0
//   push button    one side -> D2, other side -> GND (uses the internal pull-up, no resistor needed)
//
// It sends one line per change at 115200 baud:
//   "K 512"   knob position, 0-1023 (the site maps it across 10 MHz - 5 THz)
//   "B 1"     button pressed (the site jumps to the next station)
//
// Then open the site in Chrome or Edge on a computer, click About, and choose "Connect a knob".

const int KNOB_PIN = A0;
const int BUTTON_PIN = 2;

float smooth = 0;          // filtered reading, to tame the jitter every pot has
int lastSent = -100;
bool lastButton = HIGH;
unsigned long lastPress = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  smooth = analogRead(KNOB_PIN);
}

void loop() {
  smooth += (analogRead(KNOB_PIN) - smooth) * 0.2;
  int v = (int)(smooth + 0.5);
  if (abs(v - lastSent) >= 2) {          // ignore tiny wobbles
    lastSent = v;
    Serial.print("K ");
    Serial.println(v);
  }

  bool b = digitalRead(BUTTON_PIN);
  if (b == LOW && lastButton == HIGH && millis() - lastPress > 250) {   // pressed, debounced
    lastPress = millis();
    Serial.println("B 1");
  }
  lastButton = b;

  delay(10);
}
