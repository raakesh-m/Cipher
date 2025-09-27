# Cipher - AI-Powered Real-time Messaging App

<div align="center">
  <img src="./assets/icon.png" alt="Cipher Logo" width="120" height="120" />

  **A modern messaging app with AI-powered translation and enterprise-grade real-time features**

  [![Built with Expo](https://img.shields.io/badge/Built%20with-Expo-000020.svg?style=flat-square&logo=EXPO&labelColor=f3f3f3&logoColor=000)](https://expo.dev/)
  [![React Native](https://img.shields.io/badge/React%20Native-0.79.5-blue.svg?style=flat-square)](https://reactnative.dev/)
  [![Supabase](https://img.shields.io/badge/Database-Supabase-green.svg?style=flat-square)](https://supabase.com/)
  [![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
</div>

---

## 📱 About Cipher

Cipher is a sophisticated messaging application that breaks down language barriers through AI-powered real-time translation while providing enterprise-grade messaging features. Built with React Native and powered by Supabase, it offers WhatsApp-like functionality with intelligent translation capabilities using Google Gemini AI.

### 🎯 Key Differentiators

- **🤖 AI Translation**: Automatic message translation using Google Gemini AI
- **⚡ Real-time Everything**: Instant messaging, typing indicators, and online status
- **🔒 Privacy First**: Granular privacy controls for online status and translation
- **📱 Cross-Platform**: Native iOS and Android apps from a single codebase
- **🎨 Modern UI**: Polished interface with smooth animations and theming

---

## ✨ Features

### 🔐 Authentication & Security
- **Email/Password Authentication** with Supabase Auth
- **Session Persistence** with auto-refresh tokens
- **Username Validation** with uniqueness checks
- **Secure Storage** for sensitive data (API keys, tokens)

### 💬 Real-time Messaging
- **Instant Message Delivery** via Supabase real-time subscriptions
- **WhatsApp-style Message Status**:
  - 🕐 Sending (clock icon)
  - ✓ Sent (single gray check)
  - ✓✓ Delivered (double gray checks)
  - ✓✓ Read (double blue checks)
  - ⚠️ Failed (with retry functionality)
- **Optimistic UI Updates** for instant responsiveness
- **Message Retry** for failed deliveries
- **Long Message Support** (up to 1000 characters)

### 🌍 AI-Powered Translation
- **Automatic Language Detection** for incoming messages
- **Google Gemini AI Integration** for high-quality translations
- **Smart Translation Logic**:
  - Translates messages when recipient doesn't know sender's language
  - Sender-side translation for better user experience
  - Visual indicators for translated content
- **20+ Language Support** with user preferences
- **Privacy-Focused**: API keys stored securely in user profiles

### 👥 Real-time Presence
- **Typing Indicators** with 3-second smart timeouts
- **Online/Offline Status** with last seen timestamps
- **Privacy Controls**:
  - Nobody/Contacts/Everyone visibility options
  - Reciprocal privacy (if you hide, you can't see others)
- **Connection Status** indicator
- **Automatic Status Management** based on app state

### 📱 User Experience
- **User Search** with real-time results
- **Profile Management** with avatar upload and cropping
- **Media Sharing** (images and videos)
- **Push Notifications** with deep linking
- **Pull-to-Refresh** functionality
- **Modern Theme System** with dark/light mode support

### 🔧 Advanced Features
- **Media Storage** via Cloudflare R2 and Supabase Storage
- **Image Cropping** with circular overlay for avatars
- **Unread Message Counts** with real-time updates
- **Connection Recovery** with smart retry logic
- **Offline Message Queuing**
- **Performance Optimizations** with debounced searches and lazy loading

---

## 🏗️ Technical Architecture

### 📱 Frontend Stack
- **React Native 0.79.5** - Cross-platform mobile framework
- **Expo SDK 53** - Development platform and services
- **React Navigation 7** - Navigation library
- **React Context** - State management
- **Expo Image Picker** - Media selection and manipulation

### 🔥 Backend Services
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database with real-time subscriptions
  - Authentication and user management
  - Storage for user avatars
  - Row Level Security (RLS) policies
- **Cloudflare R2** - Media storage for images/videos
- **Google Gemini AI** - Translation services

### 📊 Backend Infrastructure

#### Supabase Project Details
- **Project ID**: `gyevyeaqececfwaafaak`
- **Region**: `us-east-2` (Ohio)
- **Database**: PostgreSQL 17.4.1.074
- **Status**: Active & Healthy
- **Real-time**: Enabled with subscriptions and broadcasts

#### Database Schema

##### Core Tables (Current Data)
- **`profiles`** - Extended user information (5 users)
  - Columns: id, username, display_name, gemini_api_key_encrypted, avatar_url, preferred_language, bio, expo_push_token, known_languages, online_status_privacy, last_seen_privacy, is_online, last_seen
  - RLS Enabled: ✅
  - Constraints: Username uniqueness, privacy level checks

- **`messages`** - Message content with translation (136 messages)
  - Columns: id, chat_id, sender_id, recipient_id, content_original, content_translated, message_type, media_url, status, delivered_at, read_at, translation data
  - RLS Enabled: ✅
  - Constraints: Message type validation, status validation

- **`chats`** - Conversation containers (3 active chats)
  - Columns: id, created_by, created_at, updated_at
  - RLS Enabled: ✅

- **`chat_participants`** - Many-to-many chat membership (6 participants)
  - Columns: id, chat_id, user_id, joined_at
  - RLS Enabled: ✅

- **`typing_indicators`** - Real-time typing status
  - Columns: id, chat_id, user_id, is_typing, created_at, expires_at
  - RLS Enabled: ✅

- **`language_codes`** - Available translation languages
  - Columns: code, name, native_name
  - RLS Enabled: ✅

#### Database Functions (RPC)
- **Chat Management**:
  - `find_or_create_chat(other_user_id)` - Chat creation/retrieval
  - `user_is_chat_participant(chat_uuid, user_uuid)` - Membership validation

- **Message Operations**:
  - `mark_chat_messages_read(p_chat_id, p_user_id)` - Bulk read status updates
  - `get_chat_unread_count(p_chat_id, p_user_id)` - Individual chat unread count
  - `get_unread_counts(p_user_id)` - All chats unread counts
  - `mark_messages_delivered()` - Trigger function for delivery status

- **Presence & Status**:
  - `set_user_online_status(p_user_id, p_is_online)` - Online status management
  - `get_user_status(p_user_id, p_requesting_user_id)` - Privacy-aware status retrieval
  - `update_user_presence(user_id, online)` - Legacy presence function
  - `cleanup_offline_users()` - Automated cleanup of stale statuses

- **Typing Indicators**:
  - `set_typing_status(p_chat_id, p_user_id, p_is_typing)` - Typing status updates
  - `get_typing_users(p_chat_id)` - Active typing users in chat
  - `cleanup_expired_typing_indicators()` - Remove expired indicators

- **User Management**:
  - `handle_new_user()` - Trigger for new user registration

#### Row Level Security (RLS) Policies

##### Profiles Table
- `Users can view basic profile info for search` - Public profile data for user discovery
- `Users can view their own profile` - Full access to own profile
- `Users can update their own profile` - Self-modification only
- `Users can insert their own profile` - Profile creation during signup

##### Messages Table
- `Users can view messages in their chats` - Access to chat messages
- `Users can insert messages in their chats` - Send messages to joined chats
- `Users can update their own messages` - Edit/update own messages

##### Chats Table
- `Users can view chats they participate in` - View accessible chats
- `Users can create chats` - Create new conversations

##### Chat Participants Table
- `Users can view participants of their chats` - See chat members
- `Users can add participants to chats they created` - Manage chat membership

##### Typing Indicators Table
- `Users can manage their own typing indicators` - Control own typing status
- `Users can view typing indicators in their chats` - See others typing

#### Storage Configuration

##### Cloudflare R2 (Media Storage)
- **Account ID**: `69213d412a3be5094e0b6375f470185d`
- **Bucket**: `cipher`
- **Endpoint**: Custom R2 endpoint for media files
- **Usage**: Images, videos, and file attachments
- **Security**: Presigned URLs for secure access

##### Supabase Storage
- **Usage**: User avatar images
- **Integration**: Direct upload from mobile app
- **Security**: RLS policies for access control

### 🔄 Real-time Architecture
- **Supabase Real-time** for instant message delivery
- **Presence Channels** for typing indicators
- **Broadcast Channels** for status updates
- **Connection Recovery** with exponential backoff
- **Message Queuing** for offline scenarios

---

## 📁 Project Structure

```
cipher/
├── 📱 App.js                 # Main app entry point
├── 📄 app.json              # Expo configuration
├── 📦 package.json          # Dependencies and scripts
├── ⚙️ eas.json              # Expo Application Services config
├──
├── 📂 src/
│   ├── 📂 components/       # Reusable UI components
│   │   ├── 🎨 AnimatedThemeToggle.js
│   │   ├── 📡 ConnectionStatus.js
│   │   ├── 📋 DropdownMenu.js
│   │   ├── 💬 MessageBubble.js
│   │   └── ⌨️ TypingIndicator.js
│   │
│   ├── 📂 contexts/         # React contexts
│   │   └── 🎨 ThemeContext.js
│   │
│   ├── 📂 screens/          # App screens
│   │   ├── 🔐 AuthScreen.js           # Login/Signup
│   │   ├── 📋 ChatListScreen.js       # Chat list with unread counts
│   │   ├── 💬 ChatScreen.js           # Main messaging interface
│   │   ├── 🖼️ MediaViewerScreen.js   # Full-screen media viewer
│   │   ├── 👤 ProfileScreen.js        # User profile management
│   │   ├── ⚙️ ThemedSettingsScreen.js # App settings
│   │   └── 🔍 UserSearchScreen.js     # Find users to message
│   │
│   ├── 📂 services/         # Business logic services
│   │   ├── 📨 messageStatusService.js # Message delivery tracking
│   │   ├── 🔔 notificationService.js  # Push notifications
│   │   ├── 🟢 onlineStatusService.js  # Presence management
│   │   ├── 📡 realtimeService.js      # Real-time subscriptions
│   │   └── ⌨️ typingService.js        # Typing indicators
│   │
│   └── 📂 utils/            # Utility functions
│       ├── 🌐 translation.js         # AI translation logic
│       └── 💾 r2Storage.js           # Cloudflare R2 integration
│
├── 📂 utils/
│   └── 🔧 supabase.js       # Supabase client configuration
│
├── 📂 assets/               # App assets (icons, images)
├── 📂 supabase/            # Database migrations (empty - managed via UI)
└── 📂 r2-mcp-server/       # R2 storage server components
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (macOS) or Android Studio
- Supabase account
- Cloudflare R2 account (for media storage)
- Google AI Studio account (for translation)

### 📥 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/cipher.git
   cd cipher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Cloudflare R2 Configuration
   EXPO_PUBLIC_CLOUDFLARE_R2_ACCOUNT_ID=your_r2_account_id
   EXPO_PUBLIC_R2_ACCESS_KEY_ID=your_r2_access_key
   EXPO_PUBLIC_R2_SECRET_ACCESS_KEY=your_r2_secret_key
   EXPO_PUBLIC_R2_ENDPOINT=your_r2_endpoint
   EXPO_PUBLIC_CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name
   ```

4. **Set up Supabase Database**

   Create the following tables and functions in your Supabase project:

   ```sql
   -- Enable necessary extensions
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

   -- Profiles table (extends auth.users)
   CREATE TABLE public.profiles (
     id UUID REFERENCES auth.users ON DELETE CASCADE,
     username TEXT UNIQUE NOT NULL,
     display_name TEXT,
     gemini_api_key_encrypted TEXT,
     avatar_url TEXT,
     preferred_language TEXT DEFAULT 'en',
     bio TEXT,
     expo_push_token TEXT,
     known_languages TEXT[],
     online_status_privacy TEXT DEFAULT 'everyone' CHECK (online_status_privacy IN ('everyone', 'contacts', 'nobody')),
     last_seen_privacy TEXT DEFAULT 'everyone' CHECK (last_seen_privacy IN ('everyone', 'contacts', 'nobody')),
     is_online BOOLEAN DEFAULT false,
     last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     PRIMARY KEY (id)
   );

   -- Chats table
   CREATE TABLE public.chats (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     created_by UUID REFERENCES auth.users,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Chat participants
   CREATE TABLE public.chat_participants (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
     joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Messages table
   CREATE TABLE public.messages (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
     sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
     recipient_id UUID REFERENCES profiles(id),
     content_original TEXT NOT NULL,
     content_translated TEXT,
     message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'file')),
     media_url TEXT,
     media_filename TEXT,
     media_size INTEGER,
     status VARCHAR DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
     temp_id TEXT,
     translation_source TEXT DEFAULT 'sender',
     was_translated BOOLEAN DEFAULT false,
     detected_language TEXT,
     translation_failed BOOLEAN DEFAULT false,
     translation_error TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     delivered_at TIMESTAMP WITH TIME ZONE,
     read_at TIMESTAMP WITH TIME ZONE
   );

   -- Typing indicators table
   CREATE TABLE public.typing_indicators (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
     is_typing BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 seconds')
   );

   -- Language codes table
   CREATE TABLE public.language_codes (
     code TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     native_name TEXT NOT NULL
   );

   -- Create indexes for performance
   CREATE INDEX idx_messages_chat_id ON messages(chat_id);
   CREATE INDEX idx_messages_created_at ON messages(created_at);
   CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
   CREATE INDEX idx_chat_participants_chat_id ON chat_participants(chat_id);
   CREATE INDEX idx_profiles_username ON profiles(username);

   -- Enable Row Level Security
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
   ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
   ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
   ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
   ALTER TABLE language_codes ENABLE ROW LEVEL SECURITY;

   -- Create essential database functions
   -- (Additional functions available in the full database setup)
   ```

   **📖 Complete Database Setup**: The full database schema includes 14+ RPC functions for chat management, message operations, presence tracking, and typing indicators. See the "Backend Infrastructure" section for complete details.

5. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

6. **Run on device/simulator**
   - iOS: Press `i` or scan QR code with Camera app
   - Android: Press `a` or scan QR code with Expo Go app

---

## 📱 Usage

### 🔐 Authentication
1. **Sign Up**: Create account with email, password, username, and display name
2. **Login**: Sign in with email and password
3. **Session**: Automatic session management with "Keep me signed in" option

### 💬 Messaging
1. **Find Users**: Use search to find users by username or display name
2. **Start Chat**: Tap user to create or open existing chat
3. **Send Messages**: Type and send text messages with real-time delivery
4. **Share Media**: Use camera icon to share images and videos
5. **Translation**: Enable translation in settings with your Gemini API key

### ⚙️ Settings
1. **Profile**: Update display name, bio, and avatar
2. **Translation**: Configure Gemini API key and test translation
3. **Privacy**: Control who can see your online status and last seen
4. **Theme**: Toggle between light and dark modes

---

## 🔧 Development

### 📊 Available Scripts
```bash
npm start          # Start Expo development server
npm run android    # Run on Android device/emulator
npm run ios        # Run on iOS device/simulator
npm run web        # Run on web browser
```

### 🏗️ Build for Production
```bash
# Install EAS CLI
npm install -g eas-cli

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both platforms
eas build --platform all
```

### 🧪 Testing Translation
1. Get Google AI Studio API key from [aistudio.google.com](https://aistudio.google.com)
2. Add key in Settings > Translation
3. Test translation with the built-in tester
4. Translation works automatically based on user's known languages

---

## 🔒 Security & Privacy

### 🛡️ Security Features
- **Supabase Authentication** with secure token management
- **Row Level Security (RLS)** policies on all database tables
- **Encrypted API Key Storage** for translation services
- **Input Validation** and sanitization
- **Secure File Upload** with content type validation

### 🔐 Privacy Controls
- **Online Status Privacy**: Control who can see if you're online
- **Last Seen Privacy**: Control who can see when you were last active
- **Translation Privacy**: Your API keys are stored securely and never shared
- **Message Privacy**: End-to-end database encryption via Supabase

### 🔍 Security Audit Results

#### Current Security Status
✅ **Row Level Security Enabled**: All tables have RLS policies
⚠️ **Performance Optimization Needed**: Some RLS policies need optimization
⚠️ **Security Recommendations**: Several areas for improvement identified

#### Security Recommendations
1. **Function Security**: Add `SECURITY DEFINER` and `search_path` settings to database functions
2. **Authentication Security**:
   - Enable leaked password protection against HaveIBeenPwned database
   - Implement multi-factor authentication (MFA) options
3. **Database Security**: Upgrade PostgreSQL to latest version for security patches

#### Performance Recommendations
1. **Database Indexes**: Add indexes for foreign keys to improve query performance
2. **RLS Optimization**: Optimize auth function calls in RLS policies using `(select auth.uid())`
3. **Policy Consolidation**: Merge multiple permissive policies for better performance
4. **Index Cleanup**: Remove unused indexes to reduce storage overhead

#### Compliance & Monitoring
- **Real-time Monitoring**: Supabase built-in monitoring and alerting
- **Backup Strategy**: Automated daily backups with point-in-time recovery
- **Access Logging**: Comprehensive audit logs for all database operations
- **Data Encryption**: Data encrypted at rest and in transit

---

## 🌟 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Supabase** - For the excellent real-time database and authentication
- **Expo** - For the amazing React Native development platform
- **Google AI** - For the powerful Gemini translation capabilities
- **Cloudflare** - For reliable R2 storage services
- **React Native Community** - For the incredible ecosystem

---

## 📞 Support

- 📧 Email: support@cipher-app.com
- 💬 Discord: [Join our community](https://discord.gg/cipher)
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/cipher/issues)
- 📚 Docs: [Documentation](https://cipher-app.com/docs)

---

<div align="center">
  <p>Made with ❤️ by the Cipher Team</p>
  <p>
    <a href="https://cipher-app.com">Website</a> •
    <a href="https://twitter.com/cipher_app">Twitter</a> •
    <a href="https://github.com/your-username/cipher">GitHub</a>
  </p>
</div>