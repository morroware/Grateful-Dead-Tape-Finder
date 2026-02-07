/**
 * auth.js - Authentication UI management
 */

import { checkAuth, login, register, logout } from './api.js';
import { showToast } from './utils.js';

let currentUser = null;

export function getCurrentUser() {
    return currentUser;
}

export async function initAuth() {
    try {
        currentUser = await checkAuth();
    } catch (e) {
        currentUser = null;
    }
    updateAuthUI();
    return currentUser;
}

function updateAuthUI() {
    const authArea = document.getElementById('auth-area');
    if (!authArea) return;

    if (currentUser) {
        authArea.innerHTML = `
            <div class="relative" id="user-menu-wrapper">
                <button id="user-menu-btn" class="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                    <span class="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-medium">
                        ${(currentUser.display_name || currentUser.username).charAt(0).toUpperCase()}
                    </span>
                    <span class="hidden sm:inline">${currentUser.display_name || currentUser.username}</span>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div id="user-dropdown" class="hidden absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <a href="profile.html" class="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">My Profile</a>
                    <a href="profile.html#favorites" class="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">Favorites</a>
                    <a href="profile.html#collections" class="block px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">Collections</a>
                    ${currentUser.is_admin ? '<a href="admin.html" class="block px-4 py-2.5 text-sm text-yellow-400 hover:bg-zinc-700 transition-colors">Admin Panel</a>' : ''}
                    <div class="border-t border-zinc-700"></div>
                    <button id="logout-btn" class="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors">Sign Out</button>
                </div>
            </div>`;

        const menuBtn = document.getElementById('user-menu-btn');
        const dropdown = document.getElementById('user-dropdown');
        const logoutBtn = document.getElementById('logout-btn');

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });

        logoutBtn.addEventListener('click', async () => {
            try {
                await logout();
                currentUser = null;
                updateAuthUI();
                showToast('Signed out', 'success');
                // Refresh favorites UI if on player page
                document.dispatchEvent(new CustomEvent('auth-change', { detail: { user: null } }));
            } catch (e) {
                showToast('Sign out failed', 'error');
            }
        });
    } else {
        authArea.innerHTML = `
            <a href="login.html" class="text-sm text-zinc-400 hover:text-white transition-colors">Sign In</a>`;
    }
}

export function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');

    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.classList.add('hidden');
            registerSection.classList.remove('hidden');
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            if (errorEl) errorEl.textContent = '';

            try {
                const result = await login(email, password);
                if (result && result.user) {
                    currentUser = result.user;
                    showToast('Welcome back!', 'success');
                    // Redirect to previous page or home
                    const returnTo = new URLSearchParams(window.location.search).get('return') || 'index.html';
                    window.location.href = returnTo;
                }
            } catch (error) {
                if (errorEl) errorEl.textContent = error.message || 'Login failed';
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            const errorEl = document.getElementById('register-error');

            if (errorEl) errorEl.textContent = '';

            if (password !== confirm) {
                if (errorEl) errorEl.textContent = 'Passwords do not match';
                return;
            }

            try {
                const result = await register(username, email, password);
                if (result && result.user) {
                    currentUser = result.user;
                    showToast('Account created!', 'success');
                    const returnTo = new URLSearchParams(window.location.search).get('return') || 'index.html';
                    window.location.href = returnTo;
                }
            } catch (error) {
                if (errorEl) errorEl.textContent = error.message || 'Registration failed';
            }
        });
    }
}
