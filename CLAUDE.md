# Claude Code Development Guidelines for Goodwill Referral Tool

This document provides essential guidelines and best practices for Claude Code instances working with the Goodwill Referral Tool repository.

## Project Overview

The Goodwill Referral Tool is a web application that helps Goodwill staff find appropriate resources and services for their clients. It uses AI-powered search with both traditional and RAG (Retrieval-Augmented Generation) backends to match client needs with available resources.

## Frontend Development Guidelines

### Cursor Types and Interactive Elements

**IMPORTANT: Always ensure proper cursor types for all interactive elements**

#### Required Cursor Styles:

1. **Buttons and Clickable Elements**
   - Always add `cursor-pointer` to buttons, clickable cards, and any interactive elements
   - For disabled buttons, use `cursor-not-allowed`
   - For draggable elements, use `cursor-move` or `cursor-grab`/`cursor-grabbing`

   ```typescript
   // ✅ Good - Clear cursor feedback
   <Button className="bg-blue-600 hover:bg-blue-700 cursor-pointer">

   // ✅ Good - Disabled state
   <Button disabled className="bg-gray-300 cursor-not-allowed">

   // ✅ Good - Clickable cards
   <button className="p-4 border rounded cursor-pointer hover:border-blue-600">

   // ❌ Bad - Missing cursor style
   <Button className="bg-blue-600 hover:bg-blue-700">
   ```

2. **Input Fields and Text Areas**
   - Use `cursor-text` for text inputs (usually default)
   - Use `cursor-not-allowed` for disabled inputs

3. **Links and Navigation**
   - Links should have `cursor-pointer` (usually default with proper <Link> or <a> tags)
   - Navigation items should show `cursor-pointer` when clickable

4. **Loading States**
   - Use `cursor-wait` or `cursor-progress` during loading
   - Consider `cursor-not-allowed` for elements that can't be interacted with during loading

5. **Non-Interactive Elements**
   - Use `cursor-default` for non-interactive text and containers
   - Use `cursor-help` for help icons or tooltips triggers

### Accessibility Standards

The frontend follows WCAG AAA standards with:
- **Color Contrast**: Minimum 7.6:1 ratio using Goodwill Blue (#0053A0)
- **Font Sizes**: Minimum 16px throughout the application
- **Focus States**: Visible focus rings with 2px blue outline and offset
- **ARIA Attributes**:
  - Proper labels (`aria-label`, `aria-labelledby`)
  - Live regions for dynamic content
  - Descriptions for complex interactions (`aria-describedby`)
  - Hidden decorative elements (`aria-hidden="true"` for icons)
- **Keyboard Navigation**:
  - All interactive elements accessible via keyboard
  - Skip links for main content
  - Logical tab order
  - Keyboard shortcuts clearly indicated

### UI/UX Best Practices

1. **Language and Labels**
   - Use plain, conversational language
   - Avoid technical jargon
   - Be specific but concise
   - Examples:
     - ✅ "You searched for:" instead of "Your search query:"
     - ✅ "Update your search" instead of "Update your search query"
     - ✅ "Get Better Results" instead of "Submit Query"

2. **Visual Feedback**
   - Hover states for all interactive elements
   - Clear loading indicators with descriptive text
   - Smooth transitions (use `transition-all` or specific transition properties)
   - Visual distinction between states (active, hover, disabled, loading)

3. **Component Consistency**
   - Use consistent spacing (follow Tailwind's spacing scale)
   - Maintain consistent border styles (2px for emphasis, 1px for subtle)
   - Use the same shadow levels across similar components
   - Keep consistent border radius (rounded-lg for cards, rounded for buttons)

### Color System

Primary colors based on Goodwill branding:
- **Goodwill Blue**: #0053A0 (primary actions, links, focus states)
- **Blue-600**: For primary buttons and active states
- **Blue-50**: For light blue backgrounds
- **Gray scale**: For text and secondary elements
- **Green-600**: For success and community resources
- **Red-600**: For errors and destructive actions

### Component Structure

```typescript
// Always include these essentials:
<Component
  className="... cursor-pointer" // Appropriate cursor
  aria-label="..."                // Screen reader label
  onClick={handleClick}            // Clear handler names
  disabled={isDisabled}            // Proper state management
>
  <Icon className="..." aria-hidden="true" /> // Hide decorative icons
  <span>Label Text</span>
</Component>
```

## Testing Checklist

Before committing any UI changes, verify:
- [ ] All interactive elements have appropriate cursor styles
- [ ] Buttons show `cursor-pointer` when enabled
- [ ] Disabled elements show `cursor-not-allowed`
- [ ] Color contrast meets WCAG AAA standards (7.6:1)
- [ ] All form inputs have proper labels
- [ ] ARIA attributes are properly set
- [ ] Keyboard navigation works correctly
- [ ] Loading states are clear and informative
- [ ] Error states are accessible and clear
- [ ] Mobile responsiveness is maintained

## Common Pitfalls to Avoid

1. **Missing Cursor Styles**: Always add explicit cursor styles to interactive elements
2. **Poor Contrast**: Test color combinations for accessibility
3. **Missing ARIA Labels**: Every interactive element needs proper labeling
4. **Confusing Language**: Use plain language that non-technical users understand
5. **Inconsistent Spacing**: Follow the established spacing system
6. **Hardcoded Values**: Use Tailwind classes instead of inline styles

## Git Commit Standards

When updating UI components:
```bash
git commit -m "feat: [component] Add proper cursor types and improve accessibility

- Added cursor-pointer to all interactive elements
- Implemented cursor-not-allowed for disabled states
- Added comprehensive ARIA labels
- Improved color contrast for WCAG AAA compliance
- Used plain language for better UX

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Resources

- [Tailwind CSS Cursor Utilities](https://tailwindcss.com/docs/cursor)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Best Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Goodwill Brand Guidelines](internal-link)