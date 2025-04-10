# How Our Login System Database Works

This folder contains everything needed for our single sign-on (SSO) login system. Think of it as the part that remembers who you are and keeps track of your login status across different websites.

## The Big Picture

Imagine our database as a fancy key card system at a hotel:

1. **Users** are the hotel guests
2. **Clients** are the different hotel facilities (gym, pool, restaurant)
3. **Authorization Codes** are like the receipt you get when checking in
4. **Access Tokens** are temporary key cards that expire quickly
5. **Refresh Tokens** are special passes that let you get new key cards without going back to the front desk

## How It Works (Step by Step)

1. When you want to use our system:
   - You login once with your username and password
   - We give you a temporary receipt (Authorization Code)
   - You exchange this receipt for key cards (Access Token and Refresh Token)
   - You use the Access Token to enter different apps
   - When your Access Token expires, you use the Refresh Token to get a new one
   - This way, you only need to login once

2. When you change your password:
   - All your existing key cards stop working immediately
   - This is a security feature to protect your account
   - You'll need to login again with your new password

## What's In The Database

Our database has five simple tables:

1. **Users Table** - Stores your login info and when you last changed your password
2. **Clients Table** - Lists all the apps/websites that can use our login system
3. **Access Tokens Table** - Short-lived passes for accessing apps (like a day pass)
4. **Refresh Tokens Table** - Long-lived passes for getting new access tokens (without re-entering password)
5. **Authorization Codes Table** - Temporary receipts during the login process

## Why This Design Is Smart

1. **Simple** - Just five tables that each do one thing well
2. **Secure** - Password changes automatically invalidate all sessions
3. **User-friendly** - You only need to login once to access multiple apps
4. **Reliable** - Follows the industry-standard OAuth2 protocol 

## Real-World Example

Imagine logging into our system to access both your email and calendar apps:

1. You enter your username and password once
2. Behind the scenes, we create temporary tokens
3. You can now use both email and calendar without logging in again
4. If you change your password, you'll need to login again on all devices
5. This keeps your account secure while making it convenient

That's it! No magic, just a well-organized system for remembering who you are and keeping track of your login status.