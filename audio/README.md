# Real recordings (optional)

Every station already has a sound, generated in the browser. If you'd rather play real recordings
for some of them, drop audio files in this folder and list them in `recordings.json`:

```json
{
  "jupiter": "jupiter.mp3",
  "pulsar": "cp1919.mp3",
  "cmb": "tv-static.mp3"
}
```

The names on the left are the voices you can replace: `jupiter`, `pulsar`, `broadcast`, `cmb`, `dust`.
Files loop, so trim them to a clean loop (a few seconds to a minute). MP3, M4A or WAV all work.

Good places to look, all of which publish recordings you can use with credit (check each file's terms):

- Jupiter: NASA Radio JOVE archive and the Radio JOVE community.
- CP 1919 / pulsars: the Jodrell Bank Centre for Astrophysics pulsar sounds page.
- Record your own: a cheap RTL-SDR dongle tuned between FM stations makes a great `broadcast` loop.

Add a line to the About panel (index.html, "Data and credits") for anything you use.
