'use client'

import React, { useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import {
  ArrowRight,
  Cloud,
  Database,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// Interactive workflow card component
const WorkflowCard = ({ icon: Icon, title, description, isActive, onClick }: any) => {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-100, 100], [5, -5]))
  const rotateY = useSpring(useTransform(mouseX, [-100, 100], [-5, 5]))

  return (
    <motion.div
      className={`relative p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
        isActive
          ? 'bg-slate-900 border-slate-900 text-white shadow-2xl'
          : 'bg-white/80 backdrop-blur-sm border-slate-200 text-zinc-800 hover:border-slate-300 shadow-lg hover:shadow-xl'
      }`}
      style={{
        transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        mouseX.set(e.clientX - centerX)
        mouseY.set(e.clientY - centerY)
      }}
      onMouseLeave={() => {
        mouseX.set(0)
        mouseY.set(0)
      }}
    >
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            isActive ? 'bg-white/20' : 'bg-slate-100'
          }`}
        >
          <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-zinc-700'}`} />
        </div>
        <div>
          <h3 className={`text-lg font-semibold ${isActive ? 'text-white' : 'text-zinc-900'}`}>
            {title}
          </h3>
        </div>
      </div>
      <p className={`text-sm leading-relaxed ${isActive ? 'text-white/80' : 'text-zinc-600'}`}>
        {description}
      </p>
    </motion.div>
  )
}

// Draggable workflow node component
const DraggableNode = ({ icon: Icon, label, color = 'slate' }: any) => {
  return (
    <motion.div
      className={`bg-white border-2 border-${color}-200 rounded-2xl p-4 cursor-grab active:cursor-grabbing shadow-lg hover:shadow-xl transition-all duration-300`}
      drag
      dragMomentum={false}
      whileDrag={{ scale: 1.1, rotate: 5 }}
      whileHover={{ scale: 1.05 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className={`w-10 h-10 bg-${color}-100 rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 text-${color}-600`} />
        </div>
        <span className="text-sm font-medium text-zinc-800">{label}</span>
      </div>
    </motion.div>
  )
}

function Integrations() {
  const [activeWorkflow, setActiveWorkflow] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const workflows = [
    {
      icon: Zap,
      title: 'Smart Automation',
      description: 'Automate repetitive tasks with intelligent decision-making capabilities.',
    },
    {
      icon: Database,
      title: 'Data Processing',
      description: 'Process and transform data from multiple sources in real-time.',
    },
    {
      icon: Cloud,
      title: 'Cloud Integration',
      description: 'Connect self-hosted workflows with APIs and provider services.',
    },
    {
      icon: Shield,
      title: 'Security & Compliance',
      description: 'Built-in security features and compliance monitoring.',
    },
  ]

  return (
    <section className="py-20 md:py-32 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
      {/* Agentic Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 1400 900">
            <defs>
              <linearGradient id="communityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Community network connections */}
            <g
              stroke="url(#communityGradient)"
              strokeWidth="2"
              fill="none"
              opacity="0.7"
              filter="url(#glow)"
            >
              <path d="M100,300 Q350,200 700,350 Q1050,500 1300,300" strokeDasharray="8,8">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;16"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M200,500 Q500,400 800,550 Q1100,700 1400,500" strokeDasharray="8,8">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;16"
                  dur="7s"
                  repeatCount="indefinite"
                />
              </path>
              <path d="M0,700 Q300,600 600,750 Q900,900 1200,700" strokeDasharray="8,8">
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;16"
                  dur="8s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
            {/* Community nodes */}
            <g fill="url(#communityGradient)" filter="url(#glow)">
              <circle cx="350" cy="200" r="8" opacity="0.9">
                <animate attributeName="r" values="6;10;6" dur="4s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="700" cy="350" r="8" opacity="0.9">
                <animate attributeName="r" values="6;10;6" dur="5s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="5s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="1050" cy="500" r="8" opacity="0.9">
                <animate attributeName="r" values="6;10;6" dur="6s" repeatCount="indefinite" />
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="6s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </svg>
        </div>

        {/* Floating geometric shapes */}
        <motion.div
          className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-blue-400/20 rounded-3xl backdrop-blur-sm"
          animate={{
            x: [0, 30, 0],
            y: [0, -30, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-24 h-24 bg-gradient-to-br from-cyan-400/20 to-indigo-400/20 rounded-2xl backdrop-blur-sm"
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Interactive Workflow Builder Demo */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-3xl p-8 shadow-xl mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Workflow className="w-6 h-6 text-zinc-700" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-zinc-900">Workflow Builder</h3>
                <p className="text-zinc-600">Drag components to build your workflow</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="border-slate-300"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button variant="outline" size="sm" className="border-slate-300">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Draggable Components Area */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
            <DraggableNode icon={Zap} label="Trigger" color="blue" />
            <DraggableNode icon={Database} label="Data Source" color="green" />
            <DraggableNode icon={Settings} label="Process" color="purple" />
            <DraggableNode icon={Cloud} label="Output" color="orange" />
          </div>

          {/* Canvas Area */}
          <div className="h-64 bg-white border-2 border-slate-200 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,0.15)_1px,_transparent_0)] bg-[length:20px_20px]" />
            <div className="relative z-10 h-full flex items-center justify-center">
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Sparkles className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                <p className="text-zinc-500 font-medium">
                  Drop components here to build your workflow
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
        {/* Workflow Types Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {workflows.map((workflow, index) => (
            <WorkflowCard
              key={index}
              icon={workflow.icon}
              title={workflow.title}
              description={workflow.description}
              isActive={activeWorkflow === index}
              onClick={() => setActiveWorkflow(index)}
            />
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl max-w-2xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-4">
              Ready to Build Your First AI Workflow?
            </h3>
            <p className="text-zinc-600 mb-8 text-lg">
              Start creating intelligent automation workflows in minutes, not hours. Join thousands
              of teams already building with AI.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg rounded-2xl shadow-xl shadow-slate-900/25 hover:shadow-slate-900/40 transition-all duration-300">
                <Play className="w-5 h-5 mr-2" />
                Start Building
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Integrations
