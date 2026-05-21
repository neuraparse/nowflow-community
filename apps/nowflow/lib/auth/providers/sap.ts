/**
 * Sap OAuth provider configurations.
 *
 * Extracted from lib/auth/providers.ts. Order preserved from the original
 * genericOAuthProviders array.
 */
import { logger } from '../helpers'

export const SAP_PROVIDERS = [
  {
    providerId: 'sap-s4hana',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'API_SALES_ORDER_SRV_0001',
      'API_BUSINESS_PARTNER',
      'API_MATERIAL_STOCK_SRV',
      'API_PRODUCTION_ORDER_2_SRV',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-s4hana`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          logger.error('Error fetching SAP S/4HANA user info:', {
            status: response.status,
            statusText: response.statusText,
          })
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || profile.display_name || 'SAP S/4HANA User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP S/4HANA getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'sap-successfactors',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: ['user_management', 'employee_central', 'recruiting', 'performance_goals', 'learning'],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-successfactors`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP SuccessFactors User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP SuccessFactors getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'sap-concur',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'expense.report.read',
      'expense.report.write',
      'travel.request.read',
      'travel.request.write',
      'invoice.read',
      'invoice.write',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-concur`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Concur User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Concur getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'sap-ariba',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'procurement.read',
      'procurement.write',
      'supplier.read',
      'supplier.write',
      'sourcing.read',
      'contract.read',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-ariba`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Ariba User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Ariba getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'sap-fieldglass',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'worker.read',
      'worker.write',
      'job_posting.read',
      'job_posting.write',
      'timesheet.read',
      'invoice.read',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-fieldglass`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Fieldglass User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Fieldglass getUserInfo:', { error })
        return null
      }
    },
  },
  {
    providerId: 'sap-business-one',
    clientId: process.env.SAP_CLIENT_ID as string,
    clientSecret: process.env.SAP_CLIENT_SECRET as string,
    authorizationUrl:
      process.env.SAP_AUTHORIZATION_URL ||
      'https://authentication.sap.hana.ondemand.com/oauth/authorize',
    tokenUrl:
      process.env.SAP_TOKEN_ENDPOINT || 'https://authentication.sap.hana.ondemand.com/oauth/token',
    userInfoUrl: process.env.SAP_USERINFO_URL || 'https://api.sap.com/user',
    scopes: [
      'sl.businesspartner',
      'sl.items',
      'sl.orders',
      'sl.invoices',
      'sl.inventory',
      'sl.generalledger',
    ],
    responseType: 'code',
    pkce: true,
    accessType: 'offline',
    prompt: 'consent',
    redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth2/callback/sap-business-one`,
    getUserInfo: async (tokens: any) => {
      try {
        const userInfoUrl = process.env.SAP_USERINFO_URL || 'https://api.sap.com/user'
        const response = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const profile = await response.json()
        const now = new Date()

        return {
          id: profile.id || profile.user_id || profile.sub,
          name: profile.name || 'SAP Business One User',
          email: profile.email || `${profile.id}@sap.user`,
          image: null,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        }
      } catch (error) {
        logger.error('Error in SAP Business One getUserInfo:', { error })
        return null
      }
    },
  },
]
