import {stripe} from '../lib/stripe.js';
import Coupon from '../models/coupon.model.js';
import Order from '../models/order.model.js';

export const createCheckoutSession = async (req, res) => {
  try {
    const {products, couponCode} = req.body;

    if(!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Invalid products array' });
    }

    let totalPrice = 0;
    const lineItems = products.map(product =>{
      const amount = Math.round(product.price*100);
      totalPrice += amount*product.quantity;
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            images: [product.image],
          },
          unit_amount: amount,
        },
        quantity: product.quantity || 1,
      }; 
    });

    let coupon = null;
    if(couponCode) {
      coupon = await Coupon.findOne({code: couponCode,userId:req.user._id,isActive:true});
      if(coupon){
        totalPrice  -= Math.round(totalPrice * coupon.discountPercentage / 100);
      }
    } 

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url:`${process.env.CLIENT_URL}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,  
      cancel_url:`${process.env.CLIENT_URL}/purchase-cancelled`, 
      discounts: coupon ?[
        {
          coupon: await createStripeCoupon(coupon.discountPercentage),
        }
      ]:[],
      metadata:{
        userId: req.user._id.toString(),
        couponCode: couponCode || null,
        products: JSON.stringify(
          products.map((product) => ({
            id: product._id,
            quantity: product.quantity,
            price: product.price,
          }))
        ),
      }
    });

    if(totalPrice>=20000){
      await createNewCoupon(req.user._id);
    }
    res.status(200).json({id:session.id,totalPrice:totalPrice/100});
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const checkoutSuccess = async (req, res) => {
  try {
    const {sessionId} = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const existingOrder = await Order.findOne({ stripeSessionId: sessionId });
    if (existingOrder) {
      return res.status(200).json({ message: 'Order already exists' });
    }

    if(session.payment_status === 'paid') {
      if(session.metadata.couponCode) {
        await Coupon.findOneAndUpdate({
          code: session.metadata.couponCode,
          userId: session.metadata.userId,
          isActive: true,
        }, {
          isActive: false,
        })
      }
      const products = JSON.parse(session.metadata.products);
      console.log("Products from Stripe metadata:", products);
      const newOrder = new Order({
        user: session.metadata.userId,
        products: products.map(product => ({
          product: product.id,
          quantity: product.quantity,
          price: product.price,
        })),
        totalPrice: session.amount_total / 100,
        stripeSessionId: sessionId 
      });
      await newOrder.save();
      res.status(200).json({
        success: true,
        message: 'Payment successful and order successfully placed',
        orderId: newOrder._id,
      });
    }
  } catch (error) {
    console.error('Error processing checkout success:', error);
    res.status(500).json({ error: 'Internal server error' }); 
  }
}




async function createStripeCoupon(discountPercentage) {
  const coupon = await stripe.coupons.create({
    percent_off: discountPercentage,
    duration: 'once',
  });
  return coupon.id;
}

async function createNewCoupon(userId) {
  await Coupon.findOneAndDelete({
    userId: userId,
  });
  const newCoupon = new Coupon({
    code: "Fresh" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    discountPercentage: 10,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userId: userId,
  })  
  await newCoupon.save();
  return newCoupon;
}