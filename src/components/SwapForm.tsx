import React from 'react';
import styled from 'styled-components';
import BuyToken from './BuyToken';
import SellToken from './SellToken';
import Switch from './Switch';
import Button from './Button';
import ErrorDisplay from './ErrorDisplay';
import SlippageSelector from './SlippageSelector';
import TradeComposition from './TradeComposition';
import AssetSelector from './AssetSelector';

import { observer } from 'mobx-react';
import {
    bnum,
    isEmpty,
    toWei,
    formatBalance,
    formatBalanceTruncated,
} from 'utils/helpers';
import { SwapMethods } from 'stores/SwapForm';
import { useStores } from '../contexts/storesContext';
import { ErrorIds } from '../stores/Error';
import { BigNumber } from 'utils/bignumber';
import { getSupportedChainId, web3ContextNames } from '../provider/connectors';
import { calcMaxAmountIn, calcMinAmountOut } from '../utils/sorWrapper';
import { ExactAmountInPreview, ExactAmountOutPreview } from '../stores/Proxy';

const RowContainer = styled.div`
    font-family: var(--roboto);
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
`;

const ColumnContainer = styled.div`
    font-family: var(--roboto);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

const EnterOrderDetails = styled.div`
    font-family: var(--roboto);
    font-size: 14px;
    line-height: 16px;
    display: flex;
    align-items: center;
    color: var(--header-text);
    text-align: center;
    margin-top: 6px;
    margin-bottom: 36px;
`;

const TradeCompositionPlaceholder = styled.div`
    height: 72px;
`;

const SlippageSelectorPlaceholder = styled.div`
    height: 84px;
`;

enum ButtonState {
    NO_WALLET,
    UNLOCK,
    SWAP,
}

const ButtonText = ['Connect Wallet', 'Unlock', 'Swap'];

const SwapForm = observer(({ tokenIn, tokenOut }) => {
    const {
        root: {
            proxyStore,
            swapFormStore,
            providerStore,
            tokenStore,
            errorStore,
            modalStore,
            poolStore,
        },
    } = useStores();

    const supportedChainId = getSupportedChainId();

    const web3React = providerStore.getActiveWeb3React();
    const { chainId, account } = web3React;
    const { chainId: injectedChainId } = providerStore.getWeb3React(
        web3ContextNames.injected
    );

    if (!chainId) {
        // Review error message
        throw new Error('ChainId not loaded in TestPanel');
    }

    const { inputs, outputs } = swapFormStore;
    const tokenList = tokenStore.getWhitelistedTokenMetadata(supportedChainId);

    // Set default token pair to first two in config file - currently ETH and DAI
    if (isEmpty(swapFormStore.inputs.inputToken)) {
        swapFormStore.inputs.inputToken = tokenList[0].address;
        swapFormStore.inputs.inputTicker = tokenList[0].symbol;
        swapFormStore.inputs.inputIconAddress = tokenList[0].iconAddress;
        poolStore.fetchAndSetTokenPairs(tokenList[0].address);
        swapFormStore.inputs.inputPrecision = tokenList[0].precision;
    }

    if (isEmpty(swapFormStore.inputs.outputToken)) {
        swapFormStore.inputs.outputToken = tokenList[1].address;
        swapFormStore.inputs.outputTicker = tokenList[1].symbol;
        swapFormStore.inputs.outputIconAddress = tokenList[1].iconAddress;
        poolStore.fetchAndSetTokenPairs(tokenList[1].address);
        swapFormStore.inputs.outputPrecision = tokenList[1].precision;
    }

    const {
        inputToken,
        inputTicker,
        inputIconAddress,
        inputPrecision,
        outputToken,
        outputTicker,
        outputIconAddress,
        outputPrecision,
    } = inputs;

    const buttonActionHandler = (buttonState: ButtonState) => {
        switch (buttonState) {
            case ButtonState.NO_WALLET:
                modalStore.toggleWalletModal();
                break;
            case ButtonState.SWAP:
                swapHandler();
                break;
            case ButtonState.UNLOCK:
                unlockHandler();
                break;
            default:
                throw new Error('Invalid button state');
        }
    };

    const unlockHandler = async () => {
        const tokenToUnlock = inputs.inputToken;
        const proxyAddress = tokenStore.getProxyAddress(supportedChainId);
        await tokenStore.approveMax(web3React, tokenToUnlock, proxyAddress);
    };

    const swapHandler = async () => {
        // Don't attempt Swap if preview is in progress - we don't change the UI while it's loading and hope it resolves near immediately
        if (proxyStore.isPreviewPending()) {
            return;
        }

        if (inputs.type === SwapMethods.EXACT_IN) {
            const {
                inputAmount,
                inputToken,
                outputToken,
                extraSlippageAllowance,
            } = inputs;

            const {
                spotOutput,
                expectedSlippage,
                swaps,
            } = swapFormStore.preview as ExactAmountInPreview;

            const minAmountOut = calcMinAmountOut(
                spotOutput,
                expectedSlippage.plus(bnum(extraSlippageAllowance))
            );

            await proxyStore.batchSwapExactIn(
                web3React,
                swaps,
                inputToken,
                toWei(inputAmount),
                outputToken,
                toWei(minAmountOut)
            );
        } else if (inputs.type === SwapMethods.EXACT_OUT) {
            const {
                inputToken,
                outputToken,
                outputAmount,
                extraSlippageAllowance,
            } = inputs;

            const {
                spotInput,
                expectedSlippage,
                swaps,
            } = swapFormStore.preview as ExactAmountOutPreview;

            const maxAmountIn = calcMaxAmountIn(
                spotInput,
                expectedSlippage.plus(extraSlippageAllowance)
            );

            console.log('maxAmountIn', {
                maxAmountIn: maxAmountIn.toString(),
            });

            await proxyStore.batchSwapExactOut(
                web3React,
                swaps,
                inputToken,
                maxAmountIn,
                outputToken,
                toWei(outputAmount)
            );
        }
    };

    const getButtonState = (
        account,
        userAllowance: BigNumber | undefined
    ): ButtonState => {
        const sufficientAllowance = userAllowance && userAllowance.gt(0);

        if (injectedChainId && injectedChainId !== supportedChainId) {
            return ButtonState.SWAP;
        }

        if (account) {
            if (!sufficientAllowance) {
                return ButtonState.UNLOCK;
            }
            return ButtonState.SWAP;
        }

        return ButtonState.NO_WALLET;
    };

    const getButtonText = (buttonState: ButtonState): string => {
        return ButtonText[buttonState];
    };

    const getButtonActive = (
        buttonState: ButtonState,
        inputBalance: BigNumber | undefined
    ): boolean => {
        const isInputValid = swapFormStore.isValidInput(inputs.inputAmount);
        const isExtraSlippageAmountValid = swapFormStore.isValidStatus(
            inputs.extraSlippageAllowanceErrorStatus
        );

        const isPreviewValid =
            swapFormStore.preview && !swapFormStore.preview.error;

        if (
            buttonState === ButtonState.UNLOCK ||
            buttonState === ButtonState.NO_WALLET
        ) {
            return true;
        }

        if (buttonState === ButtonState.SWAP) {
            if (
                isInputValid &&
                isExtraSlippageAmountValid &&
                injectedChainId &&
                isPreviewValid &&
                injectedChainId === supportedChainId
            ) {
                const inputAmountBN = toWei(inputs.inputAmount);
                return inputBalance && inputBalance.gte(inputAmountBN);
            }
        }

        return false;
    };

    let inputUserBalanceBN;
    let inputUserBalance;
    let truncatedInputUserBalance;
    let outputUserBalanceBN;
    let outputUserBalance;
    let truncatedOutputUserBalance;
    let userAllowance;

    if (account) {
        inputUserBalanceBN = tokenStore.getBalance(
            chainId,
            inputToken,
            account
        );

        outputUserBalanceBN = tokenStore.getBalance(
            chainId,
            outputToken,
            account
        );

        const proxyAddress = tokenStore.getProxyAddress(supportedChainId);
        userAllowance = tokenStore.getAllowance(
            chainId,
            inputToken,
            account,
            proxyAddress
        );
    }

    if (!inputUserBalanceBN) {
        inputUserBalanceBN = bnum(0);
    }

    if (!outputUserBalanceBN) {
        outputUserBalanceBN = bnum(0);
    }

    inputUserBalance = formatBalance(inputUserBalanceBN, inputPrecision);
    truncatedInputUserBalance = formatBalanceTruncated(
        inputUserBalanceBN,
        inputPrecision,
        20
    );

    outputUserBalance = formatBalance(outputUserBalanceBN, outputPrecision);
    truncatedOutputUserBalance = formatBalanceTruncated(
        outputUserBalanceBN,
        outputPrecision,
        20
    );

    const buttonState = getButtonState(account, userAllowance);

    // TODO Pull validation errors and errors in errorStore together; maybe handle a stack of active errors
    const error = errorStore.getActiveError(ErrorIds.SWAP_FORM_STORE);
    if (error) {
        console.error('error', error);
    }
    const errorMessage = outputs.activeErrorMessage;

    const renderTradeDetails = (inputAmount, outputAmount) => {
        if (isEmpty(inputAmount) && isEmpty(outputAmount)) {
            return (
                <ColumnContainer>
                    <TradeCompositionPlaceholder />
                    <EnterOrderDetails>
                        Enter Order Details to Continue
                    </EnterOrderDetails>
                    <SlippageSelectorPlaceholder />
                    <Button
                        buttonText={getButtonText(buttonState)}
                        active={getButtonActive(
                            buttonState,
                            inputUserBalanceBN
                        )}
                        onClick={() => {
                            buttonActionHandler(buttonState);
                        }}
                    />
                </ColumnContainer>
            );
        } else {
            return (
                <ColumnContainer>
                    <TradeComposition />
                    <ErrorDisplay errorText={errorMessage} />
                    <SlippageSelector />
                    <Button
                        buttonText={getButtonText(buttonState)}
                        active={getButtonActive(
                            buttonState,
                            inputUserBalanceBN
                        )}
                        onClick={() => {
                            buttonActionHandler(buttonState);
                        }}
                    />
                </ColumnContainer>
            );
        }
    };

    return (
        <div>
            <AssetSelector />
            <RowContainer>
                <SellToken
                    key="122"
                    inputID="amount-in"
                    inputName="inputAmount"
                    tokenName={inputTicker}
                    tokenBalance={inputUserBalance}
                    truncatedTokenBalance={truncatedInputUserBalance}
                    tokenAddress={inputIconAddress}
                    errorMessage={errorMessage}
                    showMax={!!account && !!inputUserBalanceBN}
                />
                <Switch />
                <BuyToken
                    key="123"
                    inputID="amount-out"
                    inputName="outputAmount"
                    tokenName={outputTicker}
                    tokenBalance={outputUserBalance}
                    truncatedTokenBalance={truncatedOutputUserBalance}
                    tokenAddress={outputIconAddress}
                    errorMessage={errorMessage}
                    showMax={!!account && !!outputUserBalanceBN}
                />
            </RowContainer>
            {renderTradeDetails(inputs.inputAmount, inputs.outputAmount)}
        </div>
    );
});

export default SwapForm;