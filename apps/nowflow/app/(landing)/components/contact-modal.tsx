'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, ExternalLink, Mail, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ENTERPRISE_URL } from '@/lib/community/enterprise'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setIsSubmitting(false)

    // Reset form after 2 seconds
    setTimeout(() => {
      setIsSubmitted(false)
      setFormData({ name: '', email: '', company: '', message: '' })
      onClose()
    }, 2000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const contactOptions = [
    {
      icon: Mail,
      title: 'Email Us',
      description: 'Get in touch via email',
      action: 'mailto:hello@nowflow.io',
      label: 'hello@nowflow.io',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: MessageCircle,
      title: 'Support',
      description: 'Product and community support',
      action: 'mailto:support@nowflow.io',
      label: 'support@nowflow.io',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Calendar,
      title: 'Schedule Call',
      description: 'Book a demo call',
      action: ENTERPRISE_URL,
      label: 'nowflow.io',
      color: 'from-green-500 to-emerald-500',
    },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/[0.06]">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Get in Touch</h2>
                <p className="text-zinc-600 dark:text-white/40 mt-1">
                  We'd love to hear from you. Send us a message!
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-zinc-400 dark:text-white/30 hover:text-zinc-600 dark:hover:text-white/60"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Contact Options */}
              <div className="lg:w-1/2 p-6 bg-slate-50 dark:bg-white/[0.02]">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                  Quick Contact
                </h3>
                <div className="space-y-4">
                  {contactOptions.map((option, index) => (
                    <motion.a
                      key={index}
                      href={option.action}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-4 p-4 bg-white dark:bg-white/[0.04] rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-slate-200 dark:border-white/[0.06] group-hover:border-slate-300 dark:group-hover:border-white/[0.1]">
                        <div
                          className={`w-12 h-12 bg-gradient-to-r ${option.color} rounded-xl flex items-center justify-center`}
                        >
                          <option.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-zinc-900 dark:text-white">
                            {option.title}
                          </h4>
                          <p className="text-sm text-zinc-600 dark:text-white/40">
                            {option.description}
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-white/30 mt-1">
                            {option.label}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-white/25 group-hover:text-zinc-600 dark:group-hover:text-white/50" />
                      </div>
                    </motion.a>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-white/[0.03] rounded-xl border border-blue-200 dark:border-white/[0.06]">
                  <h4 className="font-semibold text-blue-900 dark:text-white mb-2">
                    Enterprise Support
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-white/40">
                    Need enterprise-level support? Contact our sales team for custom solutions and
                    dedicated support.
                  </p>
                </div>
              </div>

              {/* Contact Form */}
              <div className="lg:w-1/2 p-6">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                  Send Message
                </h3>

                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 bg-green-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-green-600 dark:text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h4 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                      Message Sent!
                    </h4>
                    <p className="text-zinc-600 dark:text-white/40">
                      Thank you for reaching out. We'll get back to you soon.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block text-sm font-medium text-zinc-700 dark:text-white/75 mb-2"
                        >
                          Name *
                        </label>
                        <Input
                          id="contact-name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Your name"
                          required
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-sm font-medium text-zinc-700 dark:text-white/75 mb-2"
                        >
                          Email *
                        </label>
                        <Input
                          id="contact-email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="your@email.com"
                          required
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-company"
                        className="block text-sm font-medium text-zinc-700 dark:text-white/75 mb-2"
                      >
                        Company
                      </label>
                      <Input
                        id="contact-company"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        placeholder="Your company (optional)"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-sm font-medium text-zinc-700 dark:text-white/75 mb-2"
                      >
                        Message *
                      </label>
                      <Textarea
                        id="contact-message"
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        placeholder="Tell us about your project or question..."
                        required
                        rows={4}
                        className="w-full resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-white/90 text-white dark:text-zinc-900 py-3 rounded-lg font-medium"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        'Send Message'
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
