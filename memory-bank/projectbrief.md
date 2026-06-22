# Project Brief

## Project Name
My Website — Personal Multi-Module Web Application

## Overview
A full-stack personal web application built as a modular platform. Users are invited via single-use tokens, register, and then gain access to specific "modules" (mini-apps) based on permissions granted by an administrator. The platform currently has two modules planned: **Budget Tracker** and **Family Finances**.

## Core Goals
1. Provide a secure, invite-only user registration system
2. Offer a modular dashboard where users only see tools they have been granted access to
3. Build out individual modules as self-contained features (Budget Tracker, Family Finances)
4. Keep the architecture clean and extensible so new modules can be added easily

## Scope
- **Authentication**: JWT-based login/logout, invite-token registration, token refresh & blacklisting
- **Module Access Control**: Per-user module permissions managed via Django admin
- **Dashboard**: Displays only the modules a user has access to
- **Budget Tracker module**: Personal income/expense/budget tracking (not yet implemented)
- **Family Finances module**: Shared household finance management (not yet implemented)

## Key Constraints
- Invite-only registration — no public sign-up
- Module access is granted by an admin, not self-service
- Frontend and backend are separate applications (SPA + REST API)
- Currently a development/personal project (SQLite DB, DEBUG=True)
