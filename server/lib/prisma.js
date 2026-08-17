/**
 * server/lib/prisma.js — FIX M1
 *
 * Single shared PrismaClient instance for the whole server.
 * Import this everywhere instead of calling `new PrismaClient()` per-module.
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

module.exports = prisma
