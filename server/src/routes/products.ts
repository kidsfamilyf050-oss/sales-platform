import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/products — list all active products for company
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { companyId: req.user!.companyId, active: true },
      orderBy: { name: 'asc' },
    })
    res.json(products)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/products — create product (OWNER/ROP only)
router.post('/', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name, price } = req.body
  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'name and price required' })
  }
  try {
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        price: Number(price),
        companyId: req.user!.companyId,
      },
    })
    res.json(product)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/products/:id — update product (OWNER/ROP only)
router.put('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  const { name, price, active } = req.body
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!product) return res.status(404).json({ error: 'Not found' })

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(price !== undefined && { price: Number(price) }),
        ...(active !== undefined && { active }),
      },
    })
    res.json(updated)
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/products/:id — deactivate product (OWNER/ROP only)
router.delete('/:id', authenticate, requireRole('OWNER', 'ROP'), async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId },
    })
    if (!product) return res.status(404).json({ error: 'Not found' })

    await prisma.product.update({
      where: { id: req.params.id },
      data: { active: false },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Server error' })
  }
})

export default router
