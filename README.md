# Cipher – Secure Messaging App (Expo)

Cipher is a simple messaging application built with [Expo](https://expo.dev/) and
React Native. The goal of this project is to provide a secure, cross‑platform
foundation for building end‑to‑end encrypted chat experiences. Out of the box
this repository contains a small demo where you can send messages locally.

## Features

- ⚛️ **React Native** – write once and deploy on iOS, Android and web.
- 🔐 **Encryption‑inspired design** – icons and splash screens illustrate a
  commitment to privacy.
- 💬 **Real‑time messaging UI** – messages are rendered in a list with input
  controls for composing new chats.
- 🚀 **Expo tooling** – hot reloading, easy development workflow and over the
  air (OTA) updates.

## Getting Started

> **Note:** At the moment this repository only contains the skeleton of a
> messaging application. Messages are stored in local state and do not
> persist or sync between devices. To build a production application you will
> need to integrate authentication, a backend (e.g. Firebase, Supabase or your
> own server) and add end‑to‑end encryption.

Follow these instructions to run the app locally:

1. **Install the Expo CLI**

   If you haven’t already installed the Expo CLI, run:

   ```sh
   npm install --global expo-cli
   ```

2. **Install dependencies**

   Navigate to the project directory and install dependencies:

   ```sh
   cd cipher
   npm install
   ```

3. **Start the development server**

   Run the following command to start the Metro bundler:

   ```sh
   npm start
   ```

   This will open a browser window with the Expo DevTools. From there you can
   launch the app on an emulator, a physical device or in your web browser.

## Customisation

- **Icons & branding:** All app icons and splash screens live in the
  `assets` folder. Replace these files with your own branding as needed.
- **Adding a backend:** Integrate your preferred backend service (such as
  Firebase, Supabase or a custom API) to persist and sync messages.
- **End‑to‑end encryption:** Libraries like
  [`@privacyresearch/otrv4`](https://github.com/privacyresearchgroup/otrv4)
  or [`libsignal`](https://signal.org/docs/) can help you implement strong
  cryptography for message payloads.

## License

This project is released under the MIT License. See
[`LICENSE`](./LICENSE) for more information.