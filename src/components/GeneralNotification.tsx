import React from 'react';
import styled from 'styled-components';

const Wrapper = styled.div``;

const Warning = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    color: var(--info);
    width: 50%;
    margin: 20px auto;
    border: 1px solid var(--info);
    border-radius: 4px;
    padding: 20px;
    @media screen and (max-width: 1024px) {
        width: 80%;
    }
`;

const Message = styled.div`
    display: inline;
    font-family: Roboto;
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    line-height: 16px;
    letter-spacing: 0.2px;
`;

const WarningIcon = styled.img`
    width: 22px;
    height: 26px;
    margin-right: 20px;
    color: var(--info);
`;

const Link = styled.a`
    color: color: var(--info);
`;

const GeneralNotification = () => {
    // let isClose = false;

    // setTimeout(() => {
    //     console.log(isClose)
    //     isClose = true;
    // }, 5000);
    return (
        <Wrapper>
            <Warning>
                <WarningIcon src="info-general-notification.svg" />
                <Message style={{ textAlign: 'justify' }}>
                    该交易所已升级为使用多路径订单路由技术，从而改善整体定价和gas使用量。
                    您需要再次解锁token ,以使用新的
                    <Link
                        href="https://etherscan.io/address/0xB56b171C05d5FfCc623f8Ee497ef1Ce838179169#code"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        代理合约
                    </Link>
                    . 若要使用旧的交易所代理，请访问{' '}
                    <Link
                        href="https://legacy.balancer.exchange"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        https://legacy.balancer.exchange
                    </Link>
                </Message>
            </Warning>
        </Wrapper>
    );
};

export default GeneralNotification;
