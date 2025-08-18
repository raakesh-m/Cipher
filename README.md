# Cipher – Cloud-Synced Messenger

A modern, cloud-synced messaging application built with Expo/React Native, featuring automatic translation, real-time messaging, and secure media sharing.

## Features

- 🔐 **Secure Authentication** – User accounts with Supabase Auth
- 💬 **Real-time Messaging** – Instant message sync across devices
- 🌍 **Automatic Translation** – Messages translated using user's Gemini API key
- 📱 **Cross-platform** – Works on iOS, Android, and Web
- 🖼️ **Media Sharing** – Images and videos stored on Cloudflare R2
- 🔍 **User Discovery** – Find users by username or email
- ⚙️ **Settings Management** – Language preferences and API key configuration
- 🚀 **Modern UI** – Clean, intuitive interface with smooth animations

## How Translation Works

Each user configures their preferred language and provides their own Gemini API key:

1. **Outgoing Messages**: When you send a message, it's translated to the recipient's language using their API key
2. **Incoming Messages**: Messages you receive are translated to your language using your API key
3. **Error Handling**: If translation fails (e.g., API limit reached), the original message is shown with a retry option
4. **Media Files**: Images and videos are sent as-is without translation

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development) or Android Studio (for Android)
- Supabase project
- Cloudflare R2 bucket
- Google AI Studio account for Gemini API keys

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd cipher
npm install
```

### 2. Configure Environment Variables

The `.env` file should already be configured with your credentials:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cloudflare R2 Configuration
CLOUDFLARE_R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_ENDPOINT=your_r2_endpoint_url
CLOUDFLARE_R2_BUCKET_NAME=cipher
```

### 3. Database Setup

The database schema is automatically created when you first run the app. It includes:

- `profiles` - User profiles with language preferences and encrypted API keys
- `chats` - Chat conversations
- `chat_participants` - Chat membership
- `messages` - Messages with original and translated content
- `language_codes` - Supported languages for translation

### 4. Get Gemini API Keys

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key (free tier available)
3. Add the API key in the app's Settings screen

### 5. Run the Application

```bash
# Start the development server
npm start

# Run on specific platforms
npm run ios     # iOS simulator
npm run android # Android emulator
npm run web     # Web browser
```

## Building for Production

### iOS

```bash
# Build for iOS
expo build:ios

# Or create a development build
expo run:ios
```

### Android

```bash
# Build APK for Android
expo build:android

# Or create a development build
expo run:android
```

### Web

```bash
# Build for web
expo build:web
```

## Project Structure

```
cipher/
├── App.js                 # Main app component with navigation
├── src/
│   ├── screens/          # All screen components
│   │   ├── AuthScreen.js
│   │   ├── ChatListScreen.js
│   │   ├── ChatScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── UserSearchScreen.js
│   │   └── MediaViewerScreen.js
│   └── utils/           # Utility functions
│       ├── translation.js
│       └── r2Storage.js
├── utils/
│   └── supabase.js      # Supabase client configuration
└── assets/              # App icons and splash screens
```

## Key Technologies

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Storage**: Cloudflare R2 for media files
- **Translation**: Google Gemini API
- **Navigation**: React Navigation v6
- **State Management**: React hooks and Supabase real-time subscriptions

## Security Notes

- API keys are encrypted at rest (basic encryption - use proper key management in production)
- Row Level Security (RLS) enabled on all database tables
- Media files stored securely on Cloudflare R2
- No end-to-end encryption (messages stored in plaintext for translation)

## Limitations & Future Improvements

- **R2 Integration**: Currently simulated - implement proper S3-compatible uploads
- **API Key Encryption**: Uses basic encoding - implement proper encryption in production
- **Group Chats**: Currently supports 1-on-1 chats only
- **Push Notifications**: Not implemented
- **Message Search**: Not implemented
- **File Size Limits**: Not enforced (implement based on your needs)

## Troubleshooting

### Common Issues

1. **Translation not working**: Check your Gemini API key in Settings
2. **Messages not syncing**: Verify Supabase connection and real-time subscriptions
3. **Media upload fails**: Check R2 configuration and network connectivity
4. **App won't start**: Ensure all environment variables are set correctly

### Debug Mode

Enable debug logging by adding to your environment:

```env
EXPO_DEBUG=true
```

## License

This project is released under the MIT License. See [LICENSE](./LICENSE) for more information.

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Verify your environment configuration
3. Check Supabase and Cloudflare R2 service status
4. Review the console logs for specific error messages
