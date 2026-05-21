'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Star } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// Form schema for validation
const reviewFormSchema = z.object({
  rating: z.number().min(1, 'Please select a rating').max(5, 'Rating cannot exceed 5 stars'),
  review: z
    .string()
    .min(10, 'Review must be at least 10 characters')
    .max(500, 'Review cannot exceed 500 characters')
    .optional()
    .or(z.literal('')),
})

type ReviewFormValues = z.infer<typeof reviewFormSchema>

interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  workflowName: string
  onSubmitSuccess?: () => void
}

export function ReviewDialog({
  open,
  onOpenChange,
  workflowId,
  workflowName,
  onSubmitSuccess,
}: ReviewDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Initialize form with react-hook-form
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: 0,
      review: '',
    },
  })

  // Watch rating value for star display
  const rating = form.watch('rating')

  // Handle form submission
  const onSubmit = async (values: ReviewFormValues) => {
    try {
      setIsSubmitting(true)
      setSubmitError(null)

      // Submit rating to the API
      const response = await fetch(`/api/marketplace/${workflowId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: values.rating,
          review: values.review || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit rating')
      }

      // Reset form and close dialog on success
      form.reset()
      onOpenChange(false)

      // Call success callback if provided
      if (onSubmitSuccess) {
        onSubmitSuccess()
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit rating')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset()
      setSubmitError(null)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 rounded-[16px]">
        <DialogHeader className="px-6 pt-5 pb-4">
          <DialogTitle className="text-[15px] font-logo font-semibold text-black/85 dark:text-white/90">
            Rate & Review
          </DialogTitle>
          <DialogDescription className="text-[12px] font-logo text-black/45 dark:text-white/50 mt-1">
            Share your experience with <span className="font-medium">{workflowName}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-5">
            {/* Star Rating */}
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-logo font-semibold uppercase tracking-wider text-black/40 dark:text-white/45">
                    Rating
                  </FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => field.onChange(star)}
                          className={cn(
                            'transition-all hover:scale-110',
                            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded'
                          )}
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={cn(
                              'h-8 w-8 transition-colors',
                              star <= rating
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-black/20 dark:text-white/20'
                            )}
                          />
                        </button>
                      ))}
                      {rating > 0 && (
                        <span className="ml-2 text-[11px] font-logo text-black/40 dark:text-white/45">
                          ({rating} star{rating > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Review Text */}
            <FormField
              control={form.control}
              name="review"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-logo font-semibold uppercase tracking-wider text-black/40 dark:text-white/45">
                    Review{' '}
                    <span className="text-[10px] font-logo text-black/30 dark:text-white/35">
                      (Optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share your thoughts about this workflow..."
                      className="resize-none text-[13px] font-logo rounded-lg border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03]"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  {field.value && (
                    <p className="text-[10px] font-logo text-black/30 dark:text-white/35">
                      {field.value.length} / 500 characters
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Error message */}
            {submitError && (
              <div className="text-[12px] font-logo text-red-500/70 dark:text-red-400/70 bg-red-500/[0.04] dark:bg-red-400/[0.04] p-3 rounded-xl border border-red-500/[0.10]">
                {submitError}
              </div>
            )}

            <DialogFooter className="px-6 pb-5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="h-8 text-[12px] font-logo rounded-lg border-black/[0.06] dark:border-white/[0.06]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || rating === 0}
                className="h-8 text-[12px] font-logo font-semibold rounded-lg bg-[#4A7A68] hover:bg-[#3d6a59] dark:bg-[#94B8A6]/90 dark:hover:bg-[#94B8A6] text-white dark:text-[#1b1b1b] disabled:opacity-40"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Rating'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
