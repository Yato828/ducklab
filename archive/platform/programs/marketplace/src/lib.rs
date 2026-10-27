use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

// Development identifier only. Generate a deployment keypair and run `anchor keys sync`
// before local/devnet deployment. No production address is configured by this source.
declare_id!("Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQHG5GZKbS");

#[program]
pub mod ducklab_marketplace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, publisher: Pubkey, treasury: Pubkey) -> Result<()> {
        require!(publisher != Pubkey::default() && treasury != Pubkey::default(), MarketError::InvalidAuthority);
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.publisher = publisher;
        config.mint = ctx.accounts.mint.key();
        config.treasury = treasury;
        config.fee_bps = 1000;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn set_governance(ctx: Context<Govern>, publisher: Pubkey, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 10000 && publisher != Pubkey::default(), MarketError::InvalidFee);
        ctx.accounts.config.publisher = publisher;
        ctx.accounts.config.fee_bps = fee_bps;
        emit!(GovernanceChanged { authority: ctx.accounts.authority.key(), publisher, fee_bps });
        Ok(())
    }

    pub fn create_listing(ctx: Context<CreateListing>, manifest_hash: [u8; 32], price: u64) -> Result<()> {
        require!(price > 0, MarketError::InvalidPrice);
        require!(ctx.accounts.seller.key() != ctx.accounts.config.treasury, MarketError::InvalidRecipient);
        let listing = &mut ctx.accounts.listing;
        listing.config = ctx.accounts.config.key();
        listing.seller = ctx.accounts.seller.key();
        listing.manifest_hash = manifest_hash;
        listing.price = price;
        listing.fee_bps = ctx.accounts.config.fee_bps;
        listing.active = true;
        listing.bump = ctx.bumps.listing;
        emit!(ListingCreated { listing: listing.key(), seller: listing.seller, manifest_hash, price, fee_bps: listing.fee_bps });
        Ok(())
    }

    pub fn delist(ctx: Context<Delist>) -> Result<()> {
        ctx.accounts.listing.active = false;
        emit!(ListingDelisted { listing: ctx.accounts.listing.key() });
        Ok(())
    }

    pub fn purchase(ctx: Context<Purchase>, expected_price: u64) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.active, MarketError::Delisted);
        require!(listing.price == expected_price, MarketError::PriceChanged);
        require!(ctx.accounts.buyer.key() != listing.seller && ctx.accounts.buyer.key() != ctx.accounts.config.treasury, MarketError::InvalidRecipient);
        let fee_u128 = (listing.price as u128).checked_mul(listing.fee_bps as u128).ok_or(MarketError::Overflow)?.checked_div(10000).ok_or(MarketError::Overflow)?;
        let fee = u64::try_from(fee_u128).map_err(|_| MarketError::Overflow)?;
        let seller_paid = listing.price.checked_sub(fee).ok_or(MarketError::Overflow)?;
        if seller_paid > 0 {
            token::transfer_checked(CpiContext::new(ctx.accounts.token_program.to_account_info(), TransferChecked {
                from: ctx.accounts.buyer_tokens.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.seller_tokens.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), seller_paid, ctx.accounts.mint.decimals)?;
        }
        if fee > 0 {
            token::transfer_checked(CpiContext::new(ctx.accounts.token_program.to_account_info(), TransferChecked {
                from: ctx.accounts.buyer_tokens.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.treasury_tokens.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), fee, ctx.accounts.mint.decimals)?;
        }
        let receipt = &mut ctx.accounts.receipt;
        receipt.listing = listing.key();
        receipt.buyer = ctx.accounts.buyer.key();
        receipt.seller = listing.seller;
        receipt.mint = ctx.accounts.mint.key();
        receipt.manifest_hash = listing.manifest_hash;
        receipt.paid = listing.price;
        receipt.seller_paid = seller_paid;
        receipt.platform_fee = fee;
        receipt.slot = Clock::get()?.slot;
        receipt.bump = ctx.bumps.receipt;
        emit!(Purchased { receipt: receipt.key(), listing: listing.key(), buyer: receipt.buyer, manifest_hash: receipt.manifest_hash, paid: receipt.paid, seller_paid, platform_fee: fee });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(init, payer = authority, seeds = [b"config"], bump, space = 139)] pub config: Account<'info, MarketplaceConfig>,
    pub mint: Account<'info, Mint>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ MarketError::InvalidAuthority)]
    pub program: Program<'info, crate::program::DucklabMarketplace>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()) @ MarketError::InvalidAuthority)]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Govern<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = authority)] pub config: Account<'info, MarketplaceConfig>,
}

#[derive(Accounts)]
#[instruction(manifest_hash: [u8; 32])]
pub struct CreateListing<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = publisher)] pub config: Account<'info, MarketplaceConfig>,
    pub publisher: Signer<'info>,
    #[account(mut)] pub seller: Signer<'info>,
    #[account(init, payer = seller, seeds = [b"listing", seller.key().as_ref(), manifest_hash.as_ref()], bump, space = 116)] pub listing: Account<'info, Listing>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Delist<'info> {
    pub seller: Signer<'info>,
    #[account(mut, has_one = seller, seeds = [b"listing", seller.key().as_ref(), listing.manifest_hash.as_ref()], bump = listing.bump)] pub listing: Account<'info, Listing>,
}

#[derive(Accounts)]
pub struct Purchase<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = mint)] pub config: Account<'info, MarketplaceConfig>,
    #[account(has_one = config, seeds = [b"listing", listing.seller.as_ref(), listing.manifest_hash.as_ref()], bump = listing.bump)] pub listing: Account<'info, Listing>,
    #[account(mut)] pub buyer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = buyer)] pub buyer_tokens: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, constraint = seller_tokens.owner == listing.seller @ MarketError::InvalidRecipient)] pub seller_tokens: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, constraint = treasury_tokens.owner == config.treasury @ MarketError::InvalidRecipient)] pub treasury_tokens: Account<'info, TokenAccount>,
    #[account(init, payer = buyer, seeds = [b"receipt", listing.key().as_ref(), buyer.key().as_ref()], bump, space = 201)] pub receipt: Account<'info, PurchaseReceipt>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct MarketplaceConfig { pub authority: Pubkey, pub publisher: Pubkey, pub mint: Pubkey, pub treasury: Pubkey, pub fee_bps: u16, pub bump: u8 }
#[account]
pub struct Listing { pub config: Pubkey, pub seller: Pubkey, pub manifest_hash: [u8;32], pub price: u64, pub fee_bps: u16, pub active: bool, pub bump: u8 }
#[account]
pub struct PurchaseReceipt { pub listing: Pubkey, pub buyer: Pubkey, pub seller: Pubkey, pub mint: Pubkey, pub manifest_hash: [u8;32], pub paid: u64, pub seller_paid: u64, pub platform_fee: u64, pub slot: u64, pub bump: u8 }

#[event] pub struct ListingCreated { pub listing: Pubkey, pub seller: Pubkey, pub manifest_hash: [u8;32], pub price: u64, pub fee_bps: u16 }
#[event] pub struct ListingDelisted { pub listing: Pubkey }
#[event] pub struct Purchased { pub receipt: Pubkey, pub listing: Pubkey, pub buyer: Pubkey, pub manifest_hash: [u8;32], pub paid: u64, pub seller_paid: u64, pub platform_fee: u64 }
#[event] pub struct GovernanceChanged { pub authority: Pubkey, pub publisher: Pubkey, pub fee_bps: u16 }

#[error_code]
pub enum MarketError {
    #[msg("Publisher or authority is invalid.")] InvalidAuthority,
    #[msg("Price must be positive.")] InvalidPrice,
    #[msg("Commission must be between 0 and 10000 basis points.")] InvalidFee,
    #[msg("Payout recipient or buyer is invalid.")] InvalidRecipient,
    #[msg("Listing is delisted.")] Delisted,
    #[msg("The quoted price no longer matches.")] PriceChanged,
    #[msg("Integer overflow.")] Overflow,
}

#[cfg(test)]
mod tests {
    #[test] fn fee_rounding_u64_max() {
        let price=u64::MAX;
        let fee=(price as u128)*1000/10000;
        assert_eq!(fee,1844674407370955161);
        assert_eq!((price as u128)-fee+fee,price as u128);
    }
}
