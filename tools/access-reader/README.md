# Crunch access reader (optional, one-off tool)

**Not needed day to day.** The device connects to the CRM by itself through the ADMS relay
(`api/iclock.ts`): set its Cloud Server Setting to `www.crunchfitness.fitness` with HTTPS on.

Use this reader only for a one-time job from any computer on the gym network, for example
importing the scan history already stored on the device (the relay only sees new scans):

    python crunch_reader.py --once

What it does when it runs: it reads the fingerprint device (eSSL X2008 / ZKTeco, port 4370).

- **It only reads from the device.** It never changes users, fingerprints or settings, so the
  old attendance software keeps working exactly as before.
- **What it sends to the CRM:**
  - device online status
  - the device's user list (IDs and names, never fingerprints)
  - every scan, including the history already stored on the device
- **Scans appear in the CRM** under Attendance and on each member's profile as *Biometric*, once
  the device user is linked to a member (Settings → Access control → **Match users**).

## Install on the gym PC (Windows 10/11, about 15 minutes)

1. **Python.** Install Python 3.12 from https://www.python.org/downloads/windows/ (64-bit
   installer). On the first screen, **tick "Add python.exe to PATH"**.
2. **This folder.** Copy it to `C:\CrunchReader\`.
3. **The reader's Firebase key.**
   1. Open the Firebase console, project *crunch-fitness-blog*.
   2. Go to ⚙ Project settings → Service accounts → **Generate new private key**.
   3. Save the file into `C:\CrunchReader\` as **`serviceAccount.json`**.

   Keep it private. Don't email it or put it anywhere else: it can write to the database.
4. **Add the device in the CRM,** if you haven't already. Settings → Access control →
   Add device:
   - serial number **JJA1254700696**
   - model "eSSL X2008"
5. **Run the three steps.** Double-click, in order:
   1. `1-setup.bat` installs the reader's libraries.
   2. `2-test.bat` reads the device once. The first run uploads the history, so give it a minute.
      The device should then show **Online** in the CRM.
   3. `3-start-automatically.bat` starts the reader now and whenever this PC is logged in.
      It runs in a minimised window called *Crunch access reader*; leave it open.
6. **Match users.** In the CRM: Settings → Access control → **Match users** → **Link N
   suggested**, then choose members for the rest.

## Settings (`config.json`)

| Key | Default | |
|---|---|---|
| `deviceIp` | `192.168.1.4` | Reserved in the Airtel router (LAN → Static DHCP) |
| `devicePort` | `4370` | |
| `commKey` | `0` | Device: Menu → Comm. → PC Connection |
| `pollSeconds` | `15` | How often to look for new scans |

## If something's wrong

| What you see | Do this |
|---|---|
| The device shows *Offline* in the CRM | Check the PC is on and the *Crunch access reader* window is open. |
| Something went wrong and you need details | `reader.log` in this folder has the details. |
| You want to stop it | `stop-and-remove.bat` stops it and removes it from startup. |

To start over, delete `state.json`. The reader then re-reads the whole device history; that's
safe, because a scan is never stored twice.
